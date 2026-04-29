# Proposal: Run insights-remediations on Hummingbird Node.js

This document evaluates moving the service container from **UBI 9 minimal + RPM Node** to **Project Hummingbird** Node images (`fips` / `fips-builder` variants), including hermetic Konflux builds and operational tradeoffs.

## Version choice

| Stream | Role |
|--------|------|
| **Node 22** | What the repo uses today (UBI `nodejs:22` module). |
| **Node 24** | **Recommended** Hummingbird target if upgrading: **Active LTS** (even major), same builder/runtime pattern as 22. Example OCI labels: `version=24.14.1`, `io.hummingbird-project.stream=24`. |

### Quay image repository and tags

All streams use one repository: **[quay.io/hummingbird/nodejs](https://quay.io/repository/hummingbird/nodejs)**. The **stream** and **variant** are encoded in the **tag** (not separate image names like `nodejs-24-fips`).

**Runtime (`fips`) — Node 24**

| Example `FROM` | Tag examples |
|----------------|----------------|
| `quay.io/hummingbird/nodejs:24-fips` | `24-fips`, `24.14-fips`, `24.14.1-fips` |

**Builder (`fips-builder`) — Node 24**

| Example `FROM` | Tag examples |
|----------------|----------------|
| `quay.io/hummingbird/nodejs:24-fips-builder` | `24-fips-builder`, `24.14-fips-builder`, `24.14.1-fips-builder` |

**Runtime (`fips`) — Node 22** (same pattern as today’s UBI major)

| Example `FROM` | Tag examples |
|----------------|----------------|
| `quay.io/hummingbird/nodejs:22-fips` | `22-fips`, `22.22-fips`, `22.22.0-fips` |

**Builder (`fips-builder`) — Node 22**

| Example `FROM` | Tag examples |
|----------------|----------------|
| `quay.io/hummingbird/nodejs:22-fips-builder` | `22-fips-builder`, `22.22-fips-builder`, `22.22.0-fips-builder` |

For **production and hermetic reproducibility**, pin **`@sha256:…`** (digest) from Quay for the exact tag you choose (for example `24.14.1-fips` and `24.14.1-fips-builder`), rather than relying only on rolling tags like `24-fips`.

## Upstream Containerfile summary (Node 24)

Hummingbird builds from locked RPMs in [`hummingbird/containers`](https://gitlab.com/redhat/hummingbird/containers) (public GitLab).

**`fips-builder`** — `MAIN_PACKAGES` includes: `coreutils-single`, `nodejs24-bin`, `nodejs24-libs`, `nodejs24-npm-bin`, `bash`, `dnf5`, `shadow-utils`, FIPS crypto packages. Final image: `ENTRYPOINT ["docker-entrypoint.sh"]`, `CMD ["node"]`, `USER 65532`, `WORKDIR` default `/app`, `NODE_VERSION=24.14.1`.

**`fips` (runtime)** — same Node/npm RPM names and FIPS bits; **no** `bash`, `dnf5`, or `shadow-utils` in `MAIN_PACKAGES`. Strips some `/usr/share` content. Same entrypoint/CMD/user pattern.

**`docker-entrypoint.sh`** — same upstream-derived script as other streams: uses **`/bin/sh`**, prepends `node` when the first arg looks like a flag or is not an executable command; ends with `exec "$@"`. **`jq` is not in `MAIN_PACKAGES`** for either variant.

---

## Recommended approach

### 1. Multi-stage Dockerfile

- **Build stage:** Hummingbird **fips-builder** image for the chosen stream (for example Node **24**), **digest-pinned**.  
  Set `WORKDIR` (for example `/app` or align with existing `APP_ROOT`), copy sources, `npm ci`, `npm run build`, and tests if a dedicated `test` image/stage is kept.

- **Runtime stage:** Hummingbird **fips** (non-builder) image for the **same** stream, **digest-pinned**.  
  `COPY --from=build` only what production needs: application tree, production `node_modules` (from `npm ci --omit=dev` in the build stage), `LICENSE`, etc.

Use **image digests**, not floating `:latest`, for reproducibility and supply-chain clarity.

#### Example: multi-stage `fips-builder` → `fips` (illustrative)

Concrete shape only—**replace digests** with values from Quay, and **align file layout** with `build/Dockerfile` (e.g. `certs/`, `db/`, `gulp` build outputs, `npm ci --omit=dev` in the stage that produces `node_modules` for prod).

```dockerfile
# Resolve digests from Quay, e.g. skopeo inspect docker://quay.io/hummingbird/nodejs:24.14.1-fips-builder
ARG NODE_BUILDER=quay.io/hummingbird/nodejs:24.14.1-fips-builder@sha256:<builder-digest>
ARG NODE_RUNTIME=quay.io/hummingbird/nodejs:24.14.1-fips@sha256:<runtime-digest>

FROM ${NODE_BUILDER} AS build

ENV APP_ROOT=/opt/app-root
WORKDIR ${APP_ROOT}

COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY certs ./certs
COPY db ./db
COPY src ./src
COPY gulpfile.js jest.config.js .sequelizerc ./
RUN npm run build

# Production deps (same idea as current dist stage)
RUN npm ci --omit=dev && npm cache clean --force

FROM ${NODE_RUNTIME} AS dist

ENV APP_ROOT=/opt/app-root
WORKDIR ${APP_ROOT}

COPY --from=build ${APP_ROOT}/dist ./
COPY --from=build ${APP_ROOT}/node_modules ./node_modules
COPY --from=build ${APP_ROOT}/src ./src
COPY --from=build ${APP_ROOT}/package.json ./package.json
COPY LICENSE /licenses/

ENV NODE_ENV=production
EXPOSE 9002

# Hummingbird defaults to USER 65532; set explicitly if you adopt it
USER 65532

# After moving NODE_EXTRA_CA_CERTS / ACG_CONFIG handling into Node (no jq in image)
CMD ["node", "--max-http-header-size=16384", "src/app.js"]
```

The Hummingbird image **`ENTRYPOINT`** is `docker-entrypoint.sh` with **`CMD ["node"]`**; the **`CMD`** above is passed as arguments to the entrypoint (see upstream `docker-entrypoint.sh` behavior).

### 2. Startup: drop `jq` / shell wrapper from runtime

Hummingbird Node **package lists do not include `jq`**. The image ships a `docker-entrypoint.sh` that uses **`/bin/sh`**, but **`jq` should not be assumed**.

- **Preferred:** At process start in Node (for example early in `src/app.js` or a tiny bootstrap module), read `process.env.ACG_CONFIG`, parse JSON, set `process.env.NODE_EXTRA_CA_CERTS` from `tlsCAPath` when present, then load the app.
- **CMD** can become something like:  
  `["node", "--max-http-header-size=16384", "src/app.js"]`  
  which composes cleanly with Hummingbird’s entrypoint.

Today’s pattern:

```dockerfile
CMD [ "sh", "-c", "NODE_EXTRA_CA_CERTS=$(jq -r .tlsCAPath $ACG_CONFIG /dev/null) node ..." ]
```

should be retired in favor of the Node-side bootstrap above.

### 3. Hermetic Konflux builds

Today the pipeline uses **hermetic** mode with prefetch for **npm** and **rpm** (UBI `rpms.in.yaml` / `rpms.lock.yaml` backing `microdnf install` in the Dockerfile).

If the Dockerfile **no longer runs** `microdnf` / `dnf` / `yum`:

- Keep **`npm`** prefetch and `package-lock.json`.
- **Remove `rpm`** from `prefetch-input` and retire UBI-centric `rpms.in.yaml` / `rpms.lock.yaml` / `ubi.repo` **for this image path**, unless OS packages are still installed in the Dockerfile.

Hermetic then means: **pinned base image digest + prefetched npm + no network installs in `RUN`**.

Confirm the tenant/pipeline may **pull** (or mirror) `quay.io/hummingbird/...` bases.

### 4. User ID and OpenShift

Hummingbird images default **UID 65532**; the current Dockerfile uses **USER 1001**.

Either:

- Standardize on **65532** and update chart `runAsUser`, volume mounts, and image `chown`/ownership, or  
- Keep **1001** only if ownership and SCC expectations are explicitly validated.

### 5. Docs and automation

Update `.hermetic_builds/README.md` and any Makefile targets that assume **UBI + RPM lock generation** if this path is adopted.

---

## Team actions vs. org / policy decisions

| Item | Service team can implement | Requires org / platform / policy approval |
|------|------------------------------|-------------------------------------------|
| Multi-stage Dockerfile (`fips-builder` → `fips`), digests in `FROM` | Yes | No (once bases are allowed) |
| Node-side ACG / `NODE_EXTRA_CA_CERTS` (remove `jq` from `CMD`) | Yes | No |
| Tekton: `prefetch-input` npm-only, drop `rpm` when Dockerfile has no `microdnf` | Yes | Konflux tenant / pipeline owners may need to confirm hermetic rules |
| Charts / `runAsUser` / volume ownership for **65532** vs **1001** | Yes (in repo) | OpenShift / platform SCC expectations |
| Pull or mirror **`quay.io/hummingbird/...`** from build clusters | Coordinate with pipeline | **Registry allowlist**, firewall, mirror policy |
| **Non-UBI base** for this Insights component | Propose with this doc | **Product / security / compliance** sign-off |
| Support expectations vs. UBI-only programs | Document assumptions | **Management or platform standards** |
| `LABEL` / registry text that still imply “UBI 9” or RHEL-only | Yes | Legal / comms if customer-facing strings change |

Anything in the right column should be **explicitly checked off** before production cutover; the left column can proceed in a spike or draft PR once a non-prod registry path exists.

---

## Pros

| Area | Benefit |
|------|--------|
| **CVE / footprint** | Smaller, purpose-built rootfs vs UBI minimal + module Node + extra RPMs (`jq`, `shadow-utils`, etc.). Fewer OS packages for scanners to flag. |
| **Node stack** | Node/npm come from Hummingbird’s locked RPM set inside their image, not a separate UBI appstream module path maintained in this repo’s `rpms.lock.yaml`. |
| **Alignment** | **Node 24** gives a forward **LTS** path from today’s **22**; FIPS variants if required. |
| **Hermetic story** | Still realistic: **pinned OCI digest + npm prefetch**, with **no in-build `dnf`** if the Dockerfile does not install OS packages at build time. |

---

## Cons / risks

| Area | Risk |
|------|------|
| **Policy / support** | Konflux tenant or program may require **UBI** for Insights services. Hummingbird’s own messaging still treats some of this as **evolving**; support expectations differ from UBI. |
| **Supply chain narrative** | Shifts from “we lock UBI RPMs we install” to “we pin **their** published OCI artifact.” Still valid with digests and attestations, but a different audit story. |
| **Migration work** | `CMD`/TLS bootstrap, UID, Tekton `prefetch-input`, deployment labels referencing RHEL9/UBI if those must stay accurate, parity between `build/Dockerfile` and root `Dockerfile`. |
| **Build-time OS packages** | Hermetic **`RUN dnf install`** in the Dockerfile does **not** become easier on Hummingbird; it generally requires a supported RPM prefetch story. Prefer **no dnf in Dockerfile**. |
| **Tooling** | No **`jq`** in published package lists; **`shadow-utils`** appears on **builder** but not on the minimal **fips** list—verify any script that assumes `useradd` / similar. |
| **Major Node bump** | If moving **22 → 24**, run full **test + CI** on Node 24; watch deprecations and native deps. |

---

## Realistic?

- **Technically: yes**, for a Node service that only needs Node + npm at build time and a constrained runtime, **if** you accept **builder vs fips** stages, move TLS/ACG handling into **Node**, adjust **Konflux prefetch**, and resolve **UID**.
- **Organizationally: maybe**—depends on **allowed registries**, **UBI mandate**, and **support** for non-UBI bases. That gate often matters more than the Dockerfile.

---

## Decision checklist

1. **Platform:** Is `quay.io/hummingbird/...` (or an internal mirror) allowed for this component?
2. **Base policy:** Is non-UBI acceptable for this workload?
3. **Stream:** **24 (LTS)** vs stay on **22**—align with org support policy.
4. **Identity:** 65532 vs 1001—chart, volumes, SCC, image ownership.
5. **Hermetic:** Remove RPM prefetch path when Dockerfile has no `microdnf`; keep npm only; pin digests.
6. **Startup:** Implement ACG / `NODE_EXTRA_CA_CERTS` in Node; remove runtime `jq` dependency.
7. **Images:** Confirm exact Quay paths/tags for `fips` vs non-FIPS, builder vs runtime.
8. **Labels / compliance:** Update `LABEL` text and registry descriptions if they currently imply UBI-only.
9. **Automation:** Renovate or other bumpers tied to UBI base image need a new pattern (digest bumps).

---

## Bottom line

A **practical** approach is **Hummingbird Node 24 `fips-builder` → `fips`**, **digest-pinned**, **npm-prefetch-only hermetic** (no `dnf` in Dockerfile), **Node-based TLS bootstrap**, and an explicit **UID** decision. It is **technically realistic**; **go/no-go** is largely **policy and operations**, not whether a Dockerfile can be written.

---

## References

- Hummingbird container sources (public): [gitlab.com/redhat/hummingbird/containers](https://gitlab.com/redhat/hummingbird/containers) (for example `images/nodejs-24`).
- Project Hummingbird overview and registry: [Quay.io `hummingbird` organization](https://quay.io/organization/hummingbird).
- Current repo Dockerfile pattern: `build/Dockerfile`, root `Dockerfile`.
- Hermetic process notes: `.hermetic_builds/README.md`, Tekton `prefetch-input` in `.tekton/*.yaml`.
