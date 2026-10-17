#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { SiteStack } from '../lib/site-stack';

const app = new cdk.App();

new SiteStack(app, 'TradeIdeatorSite', {
  env: { account: '404933715334', region: 'us-east-1' },
  tags: { project: 'fantasy-football-trade-ideator' },
});
