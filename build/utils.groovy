def scale (NS, count) {
    sh "oc scale --replicas=${count} --namespace=${NS} dc/postgres"
    sh "oc scale --replicas=${count} --namespace=${NS} dc/playbooks-ssg"

    // wait for dependencies
    waitFor(NS, count, 'postgres')
    waitFor(NS, count, 'playbooks-ssg')
}

def waitFor (NS, count, resource) {
    openshift.withProject(NS) {
        timeout(2) {
            def latestDeploymentVersion = openshift.selector('dc', resource).object().status.latestVersion
            def ready = { openshift.selector('rc', "${resource}-${latestDeploymentVersion}").object().status.readyReplicas ?: 0 }

            while (ready() != count) {
                println("Waiting for ${resource} to scale to ${count} (${ready()} available)")
                sleep (5)
            }

            println("${resource} succesfully scaled to ${ready()} replicas")
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
