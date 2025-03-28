#!/bin/bash

# Help text
show_help() {
  cat << EOF >&2
Usage: $(basename "$0") [OPTIONS]

This script creates GitHub releases for packages that have been published.

Options:
  --token TOKEN             GitHub token for authentication (required)
  --repo REPO               Repository name in format owner/repo (default: current repo)
  --package-names NAMES     Comma-separated list of package names
  --package-paths PATHS     Comma-separated list of package paths
  --delete-branch BOOL      Whether to delete version branch after release (default: false)
  --help                    Display this help and exit

Example:
  $(basename "$0") --token "gh_token" --package-names "@org/pkg1,@org/pkg2" --package-paths "packages/pkg1,packages/pkg2"
EOF
}

# Default values
REPO=""
DELETE_BRANCH="false"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --token)
      TOKEN="$2"
      shift 2
      ;;
    --repo)
      REPO="$2"
      shift 2
      ;;
    --package-names)
      PACKAGE_NAMES="$2"
      shift 2
      ;;
    --package-paths)
      PACKAGE_PATHS="$2"
      shift 2
      ;;
    --delete-branch)
      DELETE_BRANCH="$2"
      shift 2
      ;;
    --help)
      show_help
      exit 0
      ;;
    *)
      echo "Error: Unknown option: $1" >&2
      show_help
      exit 1
      ;;
  esac
done

# Validate required parameters
if [[ -z "$TOKEN" ]]; then
  echo "Error: GitHub token is required" >&2
  show_help
  exit 1
fi

if [[ -z "$PACKAGE_NAMES" ]]; then
  echo "Error: Package names are required" >&2
  show_help
  exit 1
fi

if [[ -z "$PACKAGE_PATHS" ]]; then
  echo "Error: Package paths are required" >&2
  show_help
  exit 1
fi

# If repo is not provided, derive it from environment
if [[ -z "$REPO" && -n "$GITHUB_REPOSITORY" ]]; then
  REPO="$GITHUB_REPOSITORY"
elif [[ -z "$REPO" ]]; then
  echo "Error: Repository information not available" >&2
  exit 1
fi

# Convert comma-separated strings to arrays
IFS=',' read -ra NAME_ARRAY <<< "$PACKAGE_NAMES"
IFS=',' read -ra PATH_ARRAY <<< "$PACKAGE_PATHS"

if [[ ${#NAME_ARRAY[@]} -ne ${#PATH_ARRAY[@]} ]]; then
  echo "Error: Number of package names must match number of package paths" >&2
  exit 1
fi

# Setup headers for GitHub API requests
HEADER_AUTH="Authorization: token $TOKEN"
HEADER_ACCEPT="Accept: application/vnd.github+json"

# Get version branch info if it exists
VERSION_BRANCH=$(git branch -a | grep "version-packages" | sed 's/.*\///')

echo "Creating GitHub releases for published packages..." >&2
RELEASES_CREATED=0

# Process each package
for i in "${!NAME_ARRAY[@]}"; do
  PKG_NAME="${NAME_ARRAY[$i]}"
  PKG_PATH="${PATH_ARRAY[$i]}"
  
  # Clean package name for use in tag
  CLEAN_PKG_NAME=$(echo "$PKG_NAME" | sed 's/@//g' | sed 's/\//-/g')
  
  # Get package version from package.json
  if [[ -f "$PKG_PATH/package.json" ]]; then
    VERSION=$(cat "$PKG_PATH/package.json" | grep -o '"version": "[^"]*' | cut -d'"' -f4)
    
    if [[ -n "$VERSION" ]]; then
      echo "Found version $VERSION for package $PKG_NAME" >&2
      
      # Create a tag name
      TAG_NAME="${CLEAN_PKG_NAME}-v${VERSION}"
      
      # Check if tag already exists
      TAG_EXISTS=$(curl -s -H "$HEADER_AUTH" -H "$HEADER_ACCEPT" \
        "https://api.github.com/repos/$REPO/git/refs/tags/$TAG_NAME" | grep -c "\"ref\"")
      
      if [[ $TAG_EXISTS -eq 0 ]]; then
        echo "Creating tag $TAG_NAME for $PKG_NAME v$VERSION" >&2
        
        # Get latest commit SHA
        COMMIT_SHA=$(git rev-parse HEAD)
        
        # Create tag
        TAG_RESPONSE=$(curl -s -X POST -H "$HEADER_AUTH" -H "$HEADER_ACCEPT" \
          -d "{\"tag\":\"$TAG_NAME\",\"message\":\"Release $PKG_NAME v$VERSION\",\"object\":\"$COMMIT_SHA\",\"type\":\"commit\"}" \
          "https://api.github.com/repos/$REPO/git/tags")
        
        TAG_SHA=$(echo "$TAG_RESPONSE" | grep -o '"sha": "[^"]*' | head -1 | cut -d'"' -f4)
        
        if [[ -n "$TAG_SHA" ]]; then
          # Create reference for tag
          curl -s -X POST -H "$HEADER_AUTH" -H "$HEADER_ACCEPT" \
            -d "{\"ref\":\"refs/tags/$TAG_NAME\",\"sha\":\"$TAG_SHA\"}" \
            "https://api.github.com/repos/$REPO/git/refs" >/dev/null 2>&1
            
          # Create release from tag
          RELEASE_RESPONSE=$(curl -s -X POST -H "$HEADER_AUTH" -H "$HEADER_ACCEPT" \
            -d "{\"tag_name\":\"$TAG_NAME\",\"name\":\"$PKG_NAME v$VERSION\",\"body\":\"Release of $PKG_NAME version $VERSION\",\"draft\":false,\"prerelease\":false}" \
            "https://api.github.com/repos/$REPO/releases")
            
          RELEASE_ID=$(echo "$RELEASE_RESPONSE" | grep -o '"id": [0-9]*' | head -1 | cut -d' ' -f2)
          
          if [[ -n "$RELEASE_ID" ]]; then
            echo "Successfully created release for $PKG_NAME v$VERSION" >&2
            RELEASES_CREATED=$((RELEASES_CREATED + 1))
          else
            echo "Failed to create release for $PKG_NAME v$VERSION" >&2
            echo "API response: $RELEASE_RESPONSE" >&2
          fi
        else
          echo "Failed to create tag for $PKG_NAME v$VERSION" >&2
          echo "API response: $TAG_RESPONSE" >&2
        fi
      else
        echo "Tag $TAG_NAME already exists, skipping release creation" >&2
      fi
    else
      echo "Could not determine version for $PKG_NAME" >&2
    fi
  else
    echo "Package.json not found at $PKG_PATH" >&2
  fi
done

echo "Created $RELEASES_CREATED releases" >&2
echo "releases_created=$RELEASES_CREATED"

# Delete version branch if requested and it exists
if [[ "$DELETE_BRANCH" == "true" && -n "$VERSION_BRANCH" ]]; then
  echo "Deleting version branch: $VERSION_BRANCH" >&2
  
  # Use the enhanced branch deletion script with changeset cleanup
  DELETE_OUTPUT=$(bash .github/scripts/branch/delete.sh \
    --token "$TOKEN" \
    --repo "$REPO" \
    --branch "$VERSION_BRANCH" \
    --cleanup-changesets "true" \
    --max-attempts 3)
    
  if echo "$DELETE_OUTPUT" | grep -q "branch_deleted=true"; then
    echo "Successfully deleted version branch: $VERSION_BRANCH" >&2
    echo "branch_deleted=true"
  else
    echo "Warning: Failed to delete version branch: $VERSION_BRANCH" >&2
    echo "branch_deleted=false"
  fi
fi

exit 0 