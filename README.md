[![Build Status](https://jenkins-insights-jenkins.1b13.insights.openshiftapps.com/buildStatus/icon?job=insights-remediations/insights-remediations-ci)](https://jenkins-insights-jenkins.1b13.insights.openshiftapps.com/job/insights-remediations/job/insights-remediations-ci/)

# Insights Remediations

Insights Remediations is a generator of Ansible playbooks that remediate issues discovered by Red Hat Insights.

Insights Remediations supports the following types of remediations:

1. Rule-based

    This remediation type is used by Advisor and Vulnerabilities applications.
    Templates from [insights-playbooks repository](https://github.com/redhatinsights/insights-playbooks) are used.
    See [project wiki](https://github.com/redhatinsights/insights-playbooks/wiki) for more details.

1. Erratum-based

    This remediation type is used by the Vulnerabilities application.
    A single [generic template](https://github.com/RedHatInsights/insights-remediations/blob/master/src/generator/templates/vulnerabilities/errata.yml), which remediates the given erratum by upgrading relevant packages, is used.

1. SCAP Security Guide (SSG)

    This remediation type will likely be used by the Vulnerabilities application.
    Templates from [SCAP Security Guide](https://github.com/OpenSCAP/scap-security-guide) are used.


## Documentation

* [API Documentation](https://remediations-ci.1b13.insights.openshiftapps.com/docs/#/default)
* [Analysis and Design document](https://docs.google.com/document/d/13uOO5UWSkQl3AgphY-FgSnHdxi0RIrk4jeC6CqFrpec/edit?usp=sharing)
* [Insights Playbooks Wiki](https://github.com/redhatinsights/insights-playbooks/wiki)

## Getting started

### Prerequisities

* node.js 10

### Running the application locally

1. ```docker-compose -f build/docker-compose.yml up```
1. open http://localhost:9002

### Local development

1. ```docker-compose -f build/docker-compose.yml up db```
1. ```docker-compose -f build/docker-compose.yml up redis```
1. ```npm run db:ims```
1. ```npm start```
1. open http://localhost:9002

### Running tests

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

## Contact
For questions or comments join **#insights-remediations** at ansible.slack.com or contact [Jozef Hartinger](https://github.com/jharting) directly.
