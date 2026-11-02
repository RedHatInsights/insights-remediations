'use strict';

/* eslint no-process-env: off */

const path = require('path');

describe('Clowder V2 dependency endpoint resolution', () => {

    // Helper extracted from config/index.js for direct testing
    function getV2DependencyEndpoint (loadedConfig, app, deployment) {
        // eslint-disable-next-line security/detect-object-injection
        const endpoint = loadedConfig?.dependencyEndpoints?.v2?.[app]?.[deployment];
        if (endpoint && endpoint.uri) {
            return endpoint;
        }

        return undefined;
    }

    describe('getV2DependencyEndpoint', () => {
        test('returns endpoint when V2 data is present with valid URI', () => {
            const loadedConfig = {
                dependencyEndpoints: {
                    v2: {
                        rbac: {
                            service: {
                                uri: 'https://rbac.svc:8443',
                                authenticated: true,
                                ca_certificate: '/path/to/ca.crt'
                            }
                        }
                    }
                }
            };

            const result = getV2DependencyEndpoint(loadedConfig, 'rbac', 'service');
            expect(result).toBeDefined();
            expect(result.uri).toBe('https://rbac.svc:8443');
            expect(result.authenticated).toBe(true);
            expect(result.ca_certificate).toBe('/path/to/ca.crt');
        });

        test('returns undefined when V2 data is absent', () => {
            const loadedConfig = {
                dependencyEndpoints: {}
            };

            const result = getV2DependencyEndpoint(loadedConfig, 'rbac', 'service');
            expect(result).toBeUndefined();
        });

        test('returns undefined when dependencyEndpoints is missing', () => {
            const loadedConfig = {};
            const result = getV2DependencyEndpoint(loadedConfig, 'rbac', 'service');
            expect(result).toBeUndefined();
        });

        test('returns undefined when loadedConfig is null', () => {
            const result = getV2DependencyEndpoint(null, 'rbac', 'service');
            expect(result).toBeUndefined();
        });

        test('returns undefined when V2 endpoint has empty URI', () => {
            const loadedConfig = {
                dependencyEndpoints: {
                    v2: {
                        rbac: {
                            service: {
                                uri: '',
                                authenticated: false
                            }
                        }
                    }
                }
            };

            const result = getV2DependencyEndpoint(loadedConfig, 'rbac', 'service');
            expect(result).toBeUndefined();
        });

        test('returns undefined when V2 endpoint has no URI field', () => {
            const loadedConfig = {
                dependencyEndpoints: {
                    v2: {
                        rbac: {
                            service: {
                                authenticated: true
                            }
                        }
                    }
                }
            };

            const result = getV2DependencyEndpoint(loadedConfig, 'rbac', 'service');
            expect(result).toBeUndefined();
        });

        test('returns undefined for wrong app key', () => {
            const loadedConfig = {
                dependencyEndpoints: {
                    v2: {
                        rbac: {
                            service: {
                                uri: 'https://rbac.svc:8443',
                                authenticated: true
                            }
                        }
                    }
                }
            };

            const result = getV2DependencyEndpoint(loadedConfig, 'wrong-app', 'service');
            expect(result).toBeUndefined();
        });

        test('returns undefined for wrong deployment key', () => {
            const loadedConfig = {
                dependencyEndpoints: {
                    v2: {
                        rbac: {
                            service: {
                                uri: 'https://rbac.svc:8443',
                                authenticated: true
                            }
                        }
                    }
                }
            };

            const result = getV2DependencyEndpoint(loadedConfig, 'rbac', 'wrong-deployment');
            expect(result).toBeUndefined();
        });

        test('returns endpoint with authenticated false', () => {
            const loadedConfig = {
                dependencyEndpoints: {
                    v2: {
                        'sources-api': {
                            svc: {
                                uri: 'https://sources.svc:8443',
                                authenticated: false,
                                ca_certificate: null
                            }
                        }
                    }
                }
            };

            const result = getV2DependencyEndpoint(loadedConfig, 'sources-api', 'svc');
            expect(result).toBeDefined();
            expect(result.uri).toBe('https://sources.svc:8443');
            expect(result.authenticated).toBe(false);
            expect(result.ca_certificate).toBeNull();
        });
    });

    describe('config integration with V2 test data', () => {
        const savedACG = process.env.ACG_CONFIG;
        const savedRBACHost = process.env.RBAC_HOST;
        const savedSourcesHost = process.env.SOURCES_HOST;

        afterEach(() => {
            jest.resetModules();

            if (savedACG === undefined) {
                delete process.env.ACG_CONFIG;
            } else {
                process.env.ACG_CONFIG = savedACG;
            }

            if (savedRBACHost === undefined) {
                delete process.env.RBAC_HOST;
            } else {
                process.env.RBAC_HOST = savedRBACHost;
            }

            if (savedSourcesHost === undefined) {
                delete process.env.SOURCES_HOST;
            } else {
                process.env.SOURCES_HOST = savedSourcesHost;
            }
        });

        test('resolves RBAC V2 endpoint from test.json', () => {
            jest.resetModules();
            process.env.ACG_CONFIG = path.resolve(__dirname, 'test.json');
            const config = require('.');

            expect(config.rbac.host).toBe('https://rbac-service.svc.cluster.local:8443');
            expect(config.rbac.authenticated).toBe(true);
            expect(config.rbac.caCert).toBeNull();
        });

        test('resolves Sources V2 endpoint from test.json', () => {
            jest.resetModules();
            process.env.ACG_CONFIG = path.resolve(__dirname, 'test.json');
            const config = require('.');

            expect(config.sources.host).toBe('https://sources-api-svc.svc.cluster.local:8443');
            expect(config.sources.authenticated).toBe(true);
            expect(config.sources.caCert).toBeNull();
        });

        test('non-Clowder path uses env defaults', () => {
            jest.resetModules();
            delete process.env.ACG_CONFIG;
            delete process.env.RBAC_HOST;
            delete process.env.SOURCES_HOST;
            const config = require('.');

            expect(config.rbac.host).toBe('http://localhost:8080');
            expect(config.rbac.authenticated).toBe(false);
            expect(config.rbac.caCert).toBeNull();

            expect(config.sources.host).toBe('http://localhost:8080');
            expect(config.sources.authenticated).toBe(false);
            expect(config.sources.caCert).toBeNull();
        });

        test('non-Clowder path respects RBAC_HOST env var', () => {
            jest.resetModules();
            delete process.env.ACG_CONFIG;
            process.env.RBAC_HOST = 'http://custom-rbac:9000';
            const config = require('.');

            expect(config.rbac.host).toBe('http://custom-rbac:9000');
        });

        test('non-Clowder path respects SOURCES_HOST env var', () => {
            jest.resetModules();
            delete process.env.ACG_CONFIG;
            process.env.SOURCES_HOST = 'http://custom-sources:9000';
            const config = require('.');

            expect(config.sources.host).toBe('http://custom-sources:9000');
        });
    });
});
