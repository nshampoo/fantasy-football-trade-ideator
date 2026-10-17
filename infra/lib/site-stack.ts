import * as path from 'path';
import * as cdk from 'aws-cdk-lib/core';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as scheduler from 'aws-cdk-lib/aws-scheduler';
import * as schedulerTargets from 'aws-cdk-lib/aws-scheduler-targets';
import * as triggers from 'aws-cdk-lib/triggers';
import { Construct } from 'constructs';

/**
 * Trade Ideator: a static app plus one daily job.
 *
 *   CloudFront (HTTPS) ──> site bucket (private)
 *                            ├─ the app, uploaded from app/dist by `cdk deploy`
 *                            └─ data/players.json, written daily by the Players Lambda
 *
 * The browser fetches rosters from Sleeper and values from FantasyCalc itself. shampoe.com serves
 * this distribution at /trades/app/ (see the `apps` list in that repo's infra/bin/infra.ts).
 */
export class SiteStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const site = new s3.Bucket(this, 'Site', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // public access goes through CloudFront only
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true, // the app is rebuilt from app/, and the job rewrites players.json
    });

    const distribution = new cloudfront.Distribution(this, 'Cdn', {
      comment: 'Trade Ideator',
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(site),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        compress: true,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // North America + Europe edges: cheapest tier
    });

    new s3deploy.BucketDeployment(this, 'Deploy', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../../app/dist'), { exclude: ['data/*'] })],
      destinationBucket: site,
      // shampoe.com's proxy behavior doesn't cache files without Cache-Control, so set it here.
      cacheControl: [s3deploy.CacheControl.fromString('public, max-age=300')],
      // players.json is written by the job, not by deploys; excluding it also keeps the deploy's
      // cleanup step from deleting it.
      exclude: ['data/*'],
      distribution,
      distributionPaths: ['/*'],
    });

    // Daily: Sleeper's player list, trimmed, to data/players.json. Sleeper asks for that call at
    // most once a day.
    const players = new lambda.Function(this, 'Players', {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../jobs/players')),
      memorySize: 512, // the full response is ~5 MB of JSON
      timeout: cdk.Duration.minutes(1),
      environment: { BUCKET: site.bucketName },
      logGroup: new logs.LogGroup(this, 'PlayersLogs', {
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
    });
    site.grantPut(players, 'data/players.json');

    // 6 pm New York time, after Friday's final injury designations; the time zone keeps it there
    // across daylight saving.
    new scheduler.Schedule(this, 'PlayersSchedule', {
      description: 'Refresh Trade Ideator data/players.json',
      schedule: scheduler.ScheduleExpression.cron({ minute: '0', hour: '18', timeZone: cdk.TimeZone.AMERICA_NEW_YORK }),
      target: new schedulerTargets.LambdaInvoke(players, { retryAttempts: 2 }),
    });

    // Also run once on the first deploy, so the app has a player list right away.
    new triggers.Trigger(this, 'PlayersOnDeploy', {
      handler: players,
      executeOnHandlerChange: true,
      executeAfter: [site],
    });

    new cdk.CfnOutput(this, 'SiteUrl', { value: `https://${distribution.distributionDomainName}` });
    new cdk.CfnOutput(this, 'CloudFrontDomain', { value: distribution.distributionDomainName });
    new cdk.CfnOutput(this, 'PlayersFunctionName', { value: players.functionName });
  }
}
