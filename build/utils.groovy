def scale (NS, count) {
    sh "oc scale --replicas=${count} --namespace=${NS} dc/postgres"
    sh "oc scale --replicas=${count} --namespace=${NS} dc/playbooks-ssg"

    // wait for dependencies
    waitFor(NS, count, 'postgres')
    waitFor(NS, count, 'playbooks-ssg')
}

def waitFor (NS, count, resource) {
    println "waiting for ${resource} to scale to ${count}"

    openshift.withCluster() {
        openshift.withProject(NS) {
            timeout(2) {
                def latestDeploymentVersion = openshift.selector('dc', resource).object().status.latestVersion
                def rc = openshift.selector('rc', "${resource}-${latestDeploymentVersion}")
                rc.untilEach(1) {
                    def rcMap = it.object()
                    def ready = rcMap.status.readyReplicas == null ? 0 : rcMap.status.readyReplicas
                    return (rcMap.status.replicas.equals(ready))
                }
            }
        }
    }
}

def withScaledEnv(NS, Closure step) {
    lock(NS) {
        scale(NS, 1)
        sh "oc get pods --namespace ${NS}"

        try {
            step()
        } finally {
            scale(NS, 0)
            sh "oc get pods --namespace ${NS}"
        }
    }
}

return this;
