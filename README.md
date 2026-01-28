[![Build Status](https://jenkins-jenkins.5a9f.insights-dev.openshiftapps.com/buildStatus/icon?job=insights-remediations/insights-remediations-ci)](https://jenkins-jenkins.5a9f.insights-dev.openshiftapps.com/job/insights-remediations/job/insights-remediations-ci/)

# Insights Remediations

Insights Remediations is a generator of Ansible playbooks that remediate issues discovered by Red Hat Insights.

Insights Remediations supports the following types of remediations:

1. Rule-based

    This remediation type is used by Insights.
    Templates from [insights-playbooks repository](https://github.com/redhatinsights/insights-playbooks) are used.
    See [project wiki](https://github.com/redhatinsights/insights-playbooks/wiki) for more details.

1. CVE-based

    This remediation type is used by the Vulnerability application.
    A single [generic template](https://github.com/RedHatInsights/insights-remediations/blob/master/src/templates/static/vulnerabilities/cves.yml), which remediates the given set of CVEs by upgrading relevant packages, is used.

1. Erratum-based

    This remediation type is used by the System Patch Manager application.
    A single [generic template](https://github.com/RedHatInsights/insights-remediations/blob/master/src/templates/static/patchman/errata.yml), which remediates the given set of erratum by upgrading relevant packages, is used.

1. SCAP Security Guide (SSG)

    This remediation type is used by the Compliance application.
    Templates from [SCAP Security Guide](https://github.com/OpenSCAP/scap-security-guide) are used.


## Documentation

* [API Documentation](https://console.redhat.com/docs/api/remediations)
* [Analysis and Design document](https://docs.google.com/document/d/13uOO5UWSkQl3AgphY-FgSnHdxi0RIrk4jeC6CqFrpec/edit?usp=sharing)
* [Insights Playbooks Wiki](https://github.com/redhatinsights/insights-playbooks/wiki)

## Getting started

### Prerequisities

* node.js 16

### Running the application locally

1. ```docker-compose -f build/docker-compose.yml up```
1. open http://localhost:9002

### Local development

1. ```docker-compose -f build/docker-compose.yml up db```
1. ```docker-compose -f build/docker-compose.yml up redis```
1. ```npm ci```
1. ```npm run db:ims```
1. ```npm start```
1. open http://localhost:9002

To use the demo database seeder, prepend `DEMO_MODE=true ` to each of the above commands.

### Running tests

Database container has to be running as a prerequisite for tests:
```
docker-compose -f build/docker-compose.yml up db
```

To run the linter, unit and integration tests run:
```
npm run verify
```

To run a single test run:
```
npm test <path-to-test-file>
```

### Running RBAC and Kessel

To develop with RBAC and Kessel for permissions and access features you will need the inventory-api
repository which implements a common inventory system with eventing.
- Clone https://github.com/project-kessel/inventory-api
- Run `make inventory-up`

## Configuration

Application configuration can be [changed using environmental variables](https://github.com/RedHatInsights/insights-remediations/blob/master/src/config/index.js).

## Scheduled Jobs

### Remediation Plan Retention Policy (Culling Job)

The application includes a scheduled job that automatically removes old remediation plans based on a configurable retention policy. This helps manage database size and ensures compliance with data retention requirements.

**How it works:**
- The job runs daily at midnight (cron: `0 0 * * *`)
- Remediation plans are deleted when their `updated_at` timestamp is older than the configured retention period
- Deletions are processed in batches of 1000 to minimize database load
- The job logs progress including the number of remediations deleted per batch and total

**Configuration:**

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `REMEDIATION_RETENTION_DAYS` | Number of days to retain remediation plans before culling | `270` (~9 months) |
| `REMEDIATION_CULL_BATCH_SIZE` | Number of remediation plans to delete per batch | `1000` |

**Running the job manually:**

```bash
# Using npm script
npm run job:cull-remediations

# Or directly
node src/jobs/cullOldRemediations.js
```

**Running tests for the culling job:**

```bash
npm test src/jobs/cullOldRemediations.unit.js
```

## Troubleshooting

If your local database isn't updating, or it's not running as expected, run this command to remove old containers:
```
docker-compose -f build/docker-compose.yml rm -vf
```

Then, rebuild the image:
```
docker-compose -f build/docker-compose.yml build
```

## Releases

Upon any change in the master branch the branch is tested, an image is built and deployed in CI and QA environments automatically.
This process is controlled by the [deployment Jenkinsfile](./deployment/Jenkinsfile).

The image can then be promoted to production using a [Jenkins job](https://jenkins-insights-jenkins.1b13.insights.openshiftapps.com/job/remediations/job/remediations-release/). Use the git commit SHA as the REVISION when running the job.

## Contact
For questions or comments join **#platform-data-pipeline-standup** at ansible.slack.com.
