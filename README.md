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

* [API Documentation](https://remediations-ci.5a9f.insights-dev.openshiftapps.com)
* [Analysis and Design document](https://docs.google.com/document/d/13uOO5UWSkQl3AgphY-FgSnHdxi0RIrk4jeC6CqFrpec/edit?usp=sharing)
* [Insights Playbooks Wiki](https://github.com/redhatinsights/insights-playbooks/wiki)

## Getting started

### Prerequisities

* node.js 12

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

## Configuration

Application configuration can be [changed using environmental variables](https://github.com/RedHatInsights/insights-remediations/blob/master/src/config/index.js).

### Troubleshooting

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
