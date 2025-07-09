# Kessel Migration Guide

This document describes the migration from traditional RBAC to Kessel for the insights-remediations service.

## Overview

The insights-remediations service now supports both traditional RBAC and Kessel-based authorization through a feature flag. Kessel provides Relationship-based Access Control (ReBAC) using SpiceDB as the backend, offering more flexible and granular permission management.

## Configuration

### Kessel Configuration File

The service includes a Kessel configuration file (`kessel-remediations.ksl`) that defines the permission mappings from v1 RBAC to v2 workspace permissions. This file uses Kessel's DSL to:

1. **Map v1 permissions to assigned permissions**: `@rbac.add_v1_based_permission`
2. **Create contingent permissions**: `@rbac.add_contingent_permission` 
3. **Expose host permissions**: `@hbi.expose_host_permission`

Key features:
- Automatic mapping of all wildcard patterns (`remediations:*:*`, etc.)
- Contingent permissions requiring inventory access
- Host-level permission inheritance from workspaces

### Environment Variables

The following environment variables control Kessel integration:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `KESSEL_ENABLED` | Enable/disable Kessel authorization | `false` | No |
| `KESSEL_URL` | Kessel Relations API endpoint | `http://localhost:8080` | Yes (when enabled) |
| `KESSEL_INSECURE` | Skip TLS verification | `false` | No |
| `KESSEL_TIMEOUT` | Request timeout in milliseconds | `10000` | No |
| `KESSEL_RETRIES` | Number of retry attempts | `3` | No |

### Example Configuration

```bash
# Enable Kessel
export KESSEL_ENABLED=true

# Set Relations API endpoint
export KESSEL_URL=https://kessel-relations-api.example.com

# Optional: Configure timeout and retries
export KESSEL_TIMEOUT=15000
export KESSEL_RETRIES=5
```

## Migration Strategy

### Phase 1: Dual Mode (Recommended)

1. Deploy with `KESSEL_ENABLED=false` (default)
2. Traditional RBAC continues to work as before
3. Kessel connector is available but not active

### Phase 2: Kessel Testing

1. Set up Kessel Relations API and SpiceDB
2. Configure relationships and permissions in Kessel
3. Enable Kessel with `KESSEL_ENABLED=true`
4. Test authorization behavior

### Phase 3: Full Migration

1. Verify all permissions work correctly with Kessel
2. Monitor for any issues
3. Eventually remove traditional RBAC code (future)

## Kessel Permissions Model

### Workspace-Based Permissions (v2)

The new Kessel model uses workspace-based permissions instead of direct resource permissions. This provides better multi-tenancy and follows the latest RBAC v2 standards.

### Permission Structure

| V1 RBAC Permission | V2 Workspace Permission | Description |
|-------------------|------------------------|-------------|
| `remediations:remediation:read` | `remediations_read_remediation` | Read remediation plans |
| `remediations:remediation:write` | `remediations_write_remediation` | Modify remediation plans |
| `remediations:remediation:execute` | `remediations_execute_remediation` | Execute remediation plans |
| `remediations:playbook:read` | `remediations_read_playbook` | Read playbooks |
| `remediations:playbook:write` | `remediations_write_playbook` | Modify playbooks |
| `remediations:playbook:execute` | `remediations_execute_playbook` | Execute playbooks |
| `remediations:system:read` | `remediations_read_system` | Read system information |
| `remediations:system:write` | `remediations_write_system` | Modify system information |

### Permission Hierarchy

1. **V1 RBAC Permissions** → **Assigned Permissions** (e.g., `remediations_read_remediation_assigned`)
2. **Assigned Permissions** + **Inventory Access** → **Final Permissions** (e.g., `remediations_read_remediation`)
3. **Workspace Permissions** → **Host Permissions** (via HBI exposure)

### Wildcard Support

The system supports all traditional wildcard patterns:
- `remediations:*:*` - All remediations permissions
- `remediations:remediation:*` - All remediation-specific permissions
- `remediations:*:read` - All read permissions across resources

### Permission Examples

```
# Workspace-level permission
workspace:acme-workspace#remediations_read_remediation@user:alice

# Host-level permission (inherited from workspace)
host:server1.example.com#remediations_read_remediation@user:alice

# Organization admin gets all permissions
workspace:acme-workspace#remediations_write_remediation@user:bob
```

## API Integration

### Kessel Relations API

The service integrates with the Kessel Relations API using the following endpoints:

- `POST /api/relations/v1/check` - Check permissions

### Request Format

```json
{
  "resource": {
    "type": "remediations/remediation",
    "id": "*"
  },
  "relation": "read",
  "subject": {
    "type": "user",
    "id": "user123"
  }
}
```

### Response Format

```json
{
  "allowed": true
}
```

## Troubleshooting

### Common Issues

1. **Kessel SDK not found**
   - Ensure `@project-kessel/kessel-sdk` is installed
   - Check Node.js version compatibility

2. **Connection refused**
   - Verify `KESSEL_URL` is correct
   - Ensure Kessel Relations API is running
   - Check network connectivity

3. **Permission denied**
   - Verify user relationships are configured in Kessel
   - Ensure user identity is properly extracted
   - Check that workspace permissions are properly assigned

### Debugging

Enable debug logging to troubleshoot Kessel integration:

```bash
export LOG_LEVEL=debug
```

Check logs for Kessel-related messages:

```bash
grep -i kessel /path/to/logs/app.log
```

### Fallback Behavior

If Kessel is enabled but fails:
- Authorization checks return `false` (deny access)
- Errors are logged but don't crash the service
- Consider implementing circuit breaker pattern for production

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run Kessel-specific tests
npm test -- --testNamePattern="kessel"
```

### Local Development

1. Start Kessel Relations API locally:
```bash
# Using Docker Compose
docker-compose -f docker-compose.kessel.yml up -d
```

2. Configure environment:
```bash
export KESSEL_ENABLED=true
export KESSEL_URL=http://localhost:8080
export KESSEL_INSECURE=true
```

3. Start the service:
```bash
npm start
```

## Security Considerations

1. **TLS/SSL**: Always use HTTPS in production (`KESSEL_INSECURE=false`)
2. **Network Security**: Ensure Kessel Relations API is only accessible by authorized services
3. **Identity Validation**: User identity is extracted from `x-rh-identity` header
4. **Fail Secure**: Authorization failures result in access denial, not permission

## Performance

### Caching

Currently, the integration does not implement caching. Consider implementing:
- Redis-based permission caching
- Short-term in-memory caching
- Background permission refresh

### Monitoring

Monitor the following metrics:
- Kessel API response times
- Authorization check success/failure rates
- Network connectivity to Kessel Relations API

## Future Enhancements

1. **Caching Layer**: Implement Redis-based permission caching
2. **Circuit Breaker**: Add circuit breaker pattern for resilience
3. **Bulk Permissions**: Support checking multiple permissions in one request
4. **Async Processing**: Consider async permission checking for non-critical paths
5. **Policy Engine**: Integrate with Open Policy Agent (OPA) if needed

## Support

For issues related to:
- **Kessel Integration**: Check this documentation and service logs
- **Kessel Relations API**: Refer to Kessel project documentation
- **SpiceDB**: Refer to SpiceDB documentation at https://docs.authzed.com/

## References

- [Kessel Project GitHub](https://github.com/project-kessel)
- [Kessel Relations API](https://github.com/project-kessel/relations-api)
- [SpiceDB Documentation](https://docs.authzed.com/)
- [ReBAC Concepts](https://docs.authzed.com/concepts/authz) 
