pipeline {
    agent any

    options { timestamps(); disableConcurrentBuilds() }

    environment {
        BUILD_IMAGE = 'docker.io/reactnativecommunity/react-native-android:latest'
    }

    stages {
        stage('Checkout') {
            steps { checkout scm }
        }

        stage('Inject Environment') {
            steps {
                withCredentials([file(credentialsId: 'myverein-env', variable: 'SECRET_ENV')]) {
                    sh 'cp "$SECRET_ENV" .env'
                }
            }
        }

        stage('Build Release (APK + AAB)') {
            steps {
                withCredentials([
                    file(credentialsId: 'myverein-android-keystore', variable: 'ANDROID_KEYSTORE_FILE'),
                    string(credentialsId: 'myverein-android-keystore-password', variable: 'MYAPP_UPLOAD_STORE_PASSWORD'),
                    string(credentialsId: 'myverein-android-key-alias',          variable: 'MYAPP_UPLOAD_KEY_ALIAS'),
                    string(credentialsId: 'myverein-android-key-password',       variable: 'MYAPP_UPLOAD_KEY_PASSWORD')
                ]) {
                    sh '''
                        set -eu
                        podman run --rm \
                          -v "$WORKSPACE:/workspace" \
                          -v "$ANDROID_KEYSTORE_FILE:/keystore/release.keystore:ro" \
                          -w /workspace \
                          -e CI=true \
                          -e GRADLE_USER_HOME=/workspace/.gradle_cache \
                          -e npm_config_cache=/workspace/.npm_cache \
                          -e GRADLE_OPTS="-Dorg.gradle.jvmargs=-Xmx4096m -Dorg.gradle.daemon=false -Dorg.gradle.parallel=true" \
                          -e MYAPP_UPLOAD_STORE_PASSWORD -e MYAPP_UPLOAD_KEY_ALIAS -e MYAPP_UPLOAD_KEY_PASSWORD \
                          "$BUILD_IMAGE" \
                          bash -euc '
                            rm -rf node_modules package-lock.json.lock
                            npm ci --prefer-offline
                            npx expo prebuild --platform android --clean --no-install
                            cp /keystore/release.keystore android/app/release.keystore
                            cd android && chmod +x gradlew
                            ./gradlew assembleRelease bundleRelease --build-cache \
                              -PMYAPP_UPLOAD_STORE_FILE=release.keystore \
                              -PMYAPP_UPLOAD_STORE_PASSWORD="$MYAPP_UPLOAD_STORE_PASSWORD" \
                              -PMYAPP_UPLOAD_KEY_ALIAS="$MYAPP_UPLOAD_KEY_ALIAS" \
                              -PMYAPP_UPLOAD_KEY_PASSWORD="$MYAPP_UPLOAD_KEY_PASSWORD"
                          '
                    '''
                }
            }
        }
    }

    post {
        success {
            archiveArtifacts artifacts: 'android/app/build/outputs/apk/**/*.apk,android/app/build/outputs/bundle/**/*.aab', fingerprint: true
        }
        always {
            sh 'rm -f .env android/app/release.keystore'
            echo 'Build-Vorgang beendet.'
        }
    }
}