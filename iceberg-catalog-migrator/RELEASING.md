<!--
  Licensed to the Apache Software Foundation (ASF) under one
  or more contributor license agreements.  See the NOTICE file
  distributed with this work for additional information
  regarding copyright ownership.  The ASF licenses this file
  to you under the Apache License, Version 2.0 (the
  "License"); you may not use this file except in compliance
  with the License.  You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing,
  software distributed under the License is distributed on an
  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
  KIND, either express or implied.  See the License for the
  specific language governing permissions and limitations
  under the License.
-->

# Releasing Apache Polaris Iceberg Catalog Migrator

**Audience:** release managers

This runbook covers manual releases from `apache/polaris-tools`. Commands use
`origin` for the Apache Git remote; substitute another remote name if needed.

## 1. Prerequisites

* commit and tag access to <https://github.com/apache/polaris-tools>;
* ASF access to `dist.apache.org` and `repository.apache.org`;
* a GPG key published in Polaris
  [KEYS](https://downloads.apache.org/polaris/KEYS) and on a public key server;
* Git, Subversion, GPG, a JDK supported by the current build, and GNU tar
  (`gtar` on macOS); and
* a clean checkout of the Apache repository.

Never store ASF passwords, Nexus tokens, signing-key passphrases, or other
credentials in this repository, release artifacts, logs, or release emails.

Optionally start a `[DISCUSS]` thread on `dev@polaris.apache.org` to agree on
scope and release blockers.

## 2. Configure release signing

### 2.1. Create or reuse a GPG key

Skip generation if a suitable signing key already exists:

```shell
gpg --list-secret-keys --keyid-format LONG
gpg --fingerprint "<KEY_ID>"
```

Otherwise, follow the
[ASF signing guide](https://infra.apache.org/release-signing.html):

```shell
gpg --full-generate-key
```

Use the full fingerprint as `KEY_ID` and protect the private key and revocation
certificate.

### 2.2. Publish the public key

Skip this section if the key is already in
[KEYS](https://downloads.apache.org/polaris/KEYS) and on a public key server.
Never remove older keys.

To add a new key:

```shell
export KEY_ID="<FULL_GPG_FINGERPRINT>"
svn checkout https://dist.apache.org/repos/dist/release/polaris polaris-dist-release
cd polaris-dist-release
printf '\n' >> KEYS
gpg --list-sigs "${KEY_ID}" >> KEYS
gpg --armor --export "${KEY_ID}" >> KEYS
svn diff KEYS
svn commit KEYS -m "Update key for <RELEASE_MANAGER>"
```

```shell
gpg --keyserver hkps://keyserver.ubuntu.com --send-keys "${KEY_ID}"
```

Wait until it is visible at <https://downloads.apache.org/polaris/KEYS>.

### 2.3. Configure Gradle signing and Nexus credentials

Configure user-level `~/.gradle/gradle.properties`:

```properties
signing.gnupg.keyName=<FULL_GPG_FINGERPRINT>
apacheUsername=<ASF_ID>
apachePassword=<NEXUS_TOKEN_OR_PASSWORD>
```

If required:

```properties
signing.gnupg.executable=gpg
```

Or provide credentials through the environment:

```shell
export ORG_GRADLE_PROJECT_apacheUsername="<ASF_ID>"
export ORG_GRADLE_PROJECT_apachePassword="<NEXUS_TOKEN_OR_PASSWORD>"
```

Use the ASF ID, not the token name, as the username. Keep secrets out of shell
history.

## 3. Prepare a clean release checkout

Use a fresh clone or dedicated worktree:

```shell
git clone git@github.com:apache/polaris-tools.git polaris-tools-release
cd polaris-tools-release
git remote get-url origin
git fetch origin --tags
export REPO_ROOT="$(git rev-parse --show-toplevel)"
```

Confirm the remote identifies `apache/polaris-tools`, then set the coordinates:

```shell
export VERSION="x.y.z"
export RC="0"
export KEY_ID="<FULL_GPG_FINGERPRINT>"
export TOOL="iceberg-catalog-migrator"
export RELEASE_BRANCH="release/${TOOL}/${VERSION}"
export RC_TAG="apache-polaris-${TOOL}-${VERSION}-rc${RC}"
export RELEASE_TAG="apache-polaris-${TOOL}-${VERSION}"
export SOURCE_BASE="apache-polaris-${TOOL}-${VERSION}"
export BINARY_BASE="iceberg-catalog-migrator-cli-${VERSION}"
```

### 3.1. Select the Java version without creating release input

Use a JDK supported by the current build. Java 21 is the current minimum, but
that may increase in future releases.

```shell
java -version
```

With jenv, select the JDK for the current shell:

```shell
export JENV_VERSION="<INSTALLED_SUPPORTED_JAVA_VERSION>"
java -version
```

Do not run `jenv local` inside the subproject: its `.java-version` file fails
RAT. `git status --short` must be empty before building.

## 4. Prepare the release branch

### 4.1. First release candidate

For RC0, branch from current `main` and commit the release version:

```shell
cd "${REPO_ROOT}"
git checkout main
git pull --ff-only origin main
git status --short
git checkout -b "${RELEASE_BRANCH}"

printf '%s\n' "${VERSION}" > iceberg-catalog-migrator/version.txt
git diff --check
git diff -- iceberg-catalog-migrator/version.txt
git add iceberg-catalog-migrator/version.txt
git commit -m "Update Iceberg Catalog Migrator release version to ${VERSION}"
git push -u origin "${RELEASE_BRANCH}"
```

If the checkout is not clean, use a fresh checkout.

### 4.2. Replacement release candidate

For RC1 and later, keep the release branch and earlier tags. Cherry-pick only
approved fixes using their full SHAs:

```shell
cd "${REPO_ROOT}"
git checkout "${RELEASE_BRANCH}"
git pull --ff-only origin "${RELEASE_BRANCH}"
git cherry-pick "<FULL_COMMIT_SHA_FROM_MAIN>"
git diff --check
git log --oneline "<PREVIOUS_RC_TAG>..HEAD"
git push origin "${RELEASE_BRANCH}"
```

Increment `RC` and recompute `RC_TAG` before continuing.

## 5. Build and tag the candidate

Build and assemble the release outputs:

```shell
cd "${REPO_ROOT}"
git status --short
cd iceberg-catalog-migrator
./gradlew clean check assemble
```

The build must pass without excluded tasks.

Create and push an immutable tag at the verified release-branch commit:

```shell
cd "${REPO_ROOT}"
git checkout "${RELEASE_BRANCH}"
export RC_COMMIT="$(git rev-parse HEAD)"
git tag "${RC_TAG}" "${RC_COMMIT}"
git push origin "${RC_TAG}"
git checkout "${RC_TAG}"
test "$(git rev-parse HEAD)" = "${RC_COMMIT}"
export SOURCE_DATE_EPOCH="$(git show -s --format=%ct HEAD)"
printf 'RC tag: %s\nRC commit: %s\n' "${RC_TAG}" "${RC_COMMIT}"
```

Save the SHA for the vote email. Never move or reuse an RC tag.

## 6. Create and sign the source distribution

Run this from the repository root:

```shell
cd "${REPO_ROOT}"
export RELEASE_WORK="$(mktemp -d)"
printf 'Release work directory: %s\n' "${RELEASE_WORK}"

git archive \
  --prefix="${SOURCE_BASE}/" \
  --format=tar \
  HEAD \
  iceberg-catalog-migrator \
| gzip -6 --no-name > "${RELEASE_WORK}/${SOURCE_BASE}.tar.gz"

cd "${RELEASE_WORK}"
shasum -a 512 "${SOURCE_BASE}.tar.gz" > "${SOURCE_BASE}.tar.gz.sha512"
gpg --local-user "${KEY_ID}" --armor \
  --output "${SOURCE_BASE}.tar.gz.asc" \
  --detach-sig "${SOURCE_BASE}.tar.gz"
```

## 7. Publish and close a Nexus staging repository

Upload, sign, and **close** a new staging repository:

```shell
cd "${REPO_ROOT}/iceberg-catalog-migrator"
./gradlew publishToApache closeApacheStagingRepository -Prelease -PuseGpgAgent
```

Record the repository ID printed by Gradle:

```shell
export NEXUS_ID="orgapachepolaris-<ID>"
printf 'https://repository.apache.org/content/repositories/%s/\n' "${NEXUS_ID}"
```

Do not release it before the vote. Every RC needs a new staging repository.

## 8. Create and sign the convenience binary

Select GNU tar:

```shell
export GTAR="$(command -v gtar || command -v tar)"
test -x "${GTAR}"
"${GTAR}" --version
```

On macOS, this must report GNU tar, not BSD tar.

```shell
export JAR_PATH="${REPO_ROOT}/iceberg-catalog-migrator/cli/build/libs/${BINARY_BASE}.jar"
test -f "${JAR_PATH}"

"${GTAR}" --format=posix \
  --mtime="@${SOURCE_DATE_EPOCH}" \
  --owner=0 --group=0 --numeric-owner \
  --no-acls --no-selinux --no-xattrs \
  -C "$(dirname "${JAR_PATH}")" \
  -cf - "$(basename "${JAR_PATH}")" \
| gzip -6 --no-name > "${RELEASE_WORK}/${BINARY_BASE}.tar.gz"

cd "${RELEASE_WORK}"
shasum -a 512 "${BINARY_BASE}.tar.gz" > "${BINARY_BASE}.tar.gz.sha512"
gpg --local-user "${KEY_ID}" --armor \
  --output "${BINARY_BASE}.tar.gz.asc" \
  --detach-sig "${BINARY_BASE}.tar.gz"
```

## 9. Stage the candidate on Apache dist

```shell
cd "${RELEASE_WORK}"
svn checkout https://dist.apache.org/repos/dist/dev/polaris polaris-dist-dev
cd polaris-dist-dev

export DIST_REL="apache-polaris-${TOOL}/${VERSION}"
mkdir -p "${DIST_REL}"
command cp -f "${RELEASE_WORK}/${SOURCE_BASE}.tar.gz"{,.asc,.sha512} "${DIST_REL}/"
command cp -f "${RELEASE_WORK}/${BINARY_BASE}.tar.gz"{,.asc,.sha512} "${DIST_REL}/"

svn add --parents --force "${DIST_REL}"
svn status "${DIST_REL}"
```

Expect added (`A`) files for RC0 and six modified (`M`) files for a replacement
RC. There must be no other changes.

Commit only that directory:

```shell
svn commit "${DIST_REL}" -m "Stage Apache Polaris Iceberg Catalog Migrator ${VERSION} RC${RC}"
```

```text
https://dist.apache.org/repos/dist/dev/polaris/apache-polaris-iceberg-catalog-migrator/<VERSION>/
```

For a replacement RC, overwrite the files; SVN retains their history.

## 10. Follow the release verification guide

Before voting, follow the Polaris
[release verification guide](https://polaris.apache.org/community/release-guides/release-verification-guide/).

## 11. Start the PMC vote

Replace every placeholder, send to `dev@polaris.apache.org`, and allow at least
72 hours:

```text
Subject: [VOTE] Release Apache Polaris Iceberg Catalog Migrator <VERSION> RC<RC>

Hi everyone,

I propose that we release the following RC as the official
Apache Polaris Iceberg Catalog Migrator <VERSION> release.

- This corresponds to the tag: apache-polaris-iceberg-catalog-migrator-<VERSION>-rc<RC>
- https://github.com/apache/polaris-tools/commits/apache-polaris-iceberg-catalog-migrator-<VERSION>-rc<RC>/
- https://github.com/apache/polaris-tools/tree/<FULL_COMMIT_SHA>

The release tarball, signature, and checksums are here:
- https://dist.apache.org/repos/dist/dev/polaris/apache-polaris-iceberg-catalog-migrator/<VERSION>/

You can find the KEYS file here:
- https://downloads.apache.org/polaris/KEYS

Convenience binary artifacts are staged on Nexus. The Maven repository URL is:
- https://repository.apache.org/content/repositories/<NEXUS_ID>/

The release verification guide is here:
- https://polaris.apache.org/community/release-guides/release-verification-guide/

Please download, verify, and test.

Please vote in the next 72 hours.

[ ] +1 Release this as Apache Polaris Iceberg Catalog Migrator <VERSION>
[ ] +0
[ ] -1 Do not release this because...

Only PMC members have binding votes, but other community members are encouraged
to cast non-binding votes. This vote will pass if there are 3 binding +1 votes
and more binding +1 votes than -1 votes.
```

## 12. Close the vote

After at least 72 hours and sufficient binding votes, reply on the vote thread
with subject:

```text
Subject: [RESULT][VOTE] Release Apache Polaris Iceberg Catalog Migrator <VERSION> RC<RC>
```

Include the voters, binding status, totals, and outcome. If the vote fails, keep
the tag, fix the same branch, use the next RC number and a new Nexus repository,
and replace the six SVN files. Never release an abandoned Nexus repository.

## 13. Publish an approved release

Publish exactly what was voted on; do not rebuild it.

### 13.1. Move the distributions to the release repository

```shell
svn mv \
  "https://dist.apache.org/repos/dist/dev/polaris/apache-polaris-${TOOL}/${VERSION}" \
  "https://dist.apache.org/repos/dist/release/polaris/apache-polaris-${TOOL}/${VERSION}" \
  -m "Release Apache Polaris Iceberg Catalog Migrator ${VERSION}"
```

### 13.2. Create the final Git tag and GitHub release

```shell
cd "${REPO_ROOT}"
git fetch origin --tags
git tag "${RELEASE_TAG}" "${RC_TAG}"
git push origin "${RELEASE_TAG}"
```

Create the GitHub release and link to the Apache download; do not attach copies.

### 13.3. Release the Nexus staging repository

```shell
cd "${REPO_ROOT}"
git checkout "${RC_TAG}"
cd iceberg-catalog-migrator
./gradlew releaseApacheStagingRepository -Prelease -PuseGpgAgent
```

Alternatively, release the exact repository through the
[Nexus UI](https://repository.apache.org/#stagingRepositories). Use one method
only; do not run `publishToApache` again.

### 13.4. Announce the release

After Apache mirrors and Maven Central synchronize, announce the release:

```text
Subject: [ANNOUNCE] Apache Polaris Iceberg Catalog Migrator <VERSION> released

The Apache Polaris community is pleased to announce the release of Apache
Polaris Iceberg Catalog Migrator <VERSION>.

The release is available at:
https://downloads.apache.org/polaris/apache-polaris-iceberg-catalog-migrator/<VERSION>/

Release tag:
https://github.com/apache/polaris-tools/releases/tag/apache-polaris-iceberg-catalog-migrator-<VERSION>

Thank you to everyone who contributed to and verified this release.
```

After mirroring completes, remove superseded versions from `dist/release`
according to ASF and project policy; they remain in the Apache archive.
