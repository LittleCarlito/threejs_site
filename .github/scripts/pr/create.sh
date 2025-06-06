#!/bin/bash

# Exit on error
set -e

# Enable debug mode with DEBUG=1
if [ "${DEBUG:-0}" = "1" ]; then
    set -x
fi

# Function to create a new branch
create_branch() {
    local branch_name=$1
    local base_branch=${2:-main}
    
    # Validate branch names
    if [ -z "$branch_name" ]; then
        echo "Error: Empty branch name provided" >&2
        return 1
    fi
    
    if [ -z "$base_branch" ]; then
        echo "Error: Empty base branch name provided" >&2
        return 1
    fi
    
    echo "Creating branch: $branch_name from $base_branch" >&2
    
    # Fetch latest changes
    local fetch_output=""
    fetch_output=$(git fetch origin "$base_branch" 2>&1 >&2) || {
        echo "Error fetching $base_branch: $fetch_output" >&2
        return 1
    }
    
    # Check if branch already exists
    if git show-ref --verify --quiet refs/heads/"$branch_name" 2>&1 >&2; then
        echo "Warning: Branch $branch_name already exists locally, checking out existing branch" >&2
        git checkout "$branch_name" 2>&1 >&2 || return 1
        return 0
    fi
    
    # Check if branch exists on remote
    if git show-ref --verify --quiet refs/remotes/origin/"$branch_name" 2>&1 >&2; then
        echo "Warning: Branch $branch_name already exists on remote, checking out existing branch" >&2
        git checkout -b "$branch_name" "origin/$branch_name" 2>&1 >&2 || return 1
        return 0
    fi
    
    # Create and checkout new branch
    git checkout -b "$branch_name" "origin/$base_branch" 2>&1 >&2 || {
        echo "Error creating branch $branch_name from origin/$base_branch" >&2
        return 1
    }
    
    return 0
}

# Function to commit changes
commit_changes() {
    local message=$1
    local files=("${@:2}")
    
    if [ -z "$message" ]; then
        echo "Error: Empty commit message provided" >&2
        return 1
    fi
    
    if [ ${#files[@]} -eq 0 ]; then
        echo "Warning: No files specified for commit" >&2
        return 0
    fi
    
    echo "Committing changes..." >&2
    local files_added=0
    
    # Add files
    for file in "${files[@]}"; do
        if [ -f "$file" ] || [ -d "$file" ]; then
            git add "$file" 2>&1 >&2 || {
                echo "Warning: Failed to add $file to staging area" >&2
                continue
            }
            files_added=$((files_added + 1))
            echo "Added $file to staging area" >&2
        else
            echo "Warning: File $file does not exist" >&2
        fi
    done
    
    if [ $files_added -eq 0 ]; then
        echo "Error: No valid files to commit" >&2
        return 1
    fi
    
    # Check if there are staged changes
    if ! git diff --cached --quiet 2>&1 >&2; then
        # Commit changes
        git commit -m "$message" 2>&1 >&2 || {
            echo "Error committing changes" >&2
            return 1
        }
        echo "Successfully committed changes with message: $message" >&2
    else
        echo "Warning: No changes to commit" >&2
    fi
    
    return 0
}

# Function to push changes
push_changes() {
    local branch_name=$1
    
    if [ -z "$branch_name" ]; then
        echo "Error: Empty branch name provided" >&2
        return 1
    fi
    
    echo "Pushing changes to $branch_name..." >&2
    
    local push_output=""
    push_output=$(git push origin "$branch_name" 2>&1 >&2) || {
        echo "Error pushing changes to $branch_name: $push_output" >&2
        return 1
    }
    
    echo "Successfully pushed changes to $branch_name"
    return 0
}

# Function to create PR
create_pull_request() {
    local title=$1
    local body=$2
    local head_branch=$3
    local base_branch=${4:-main}
    local labels=("${@:5}")
    
    # Validate parameters
    if [ -z "$title" ]; then
        echo "Error: Empty PR title provided" >&2
        return 1
    fi
    
    if [ -z "$head_branch" ]; then
        echo "Error: Empty head branch provided" >&2
        return 1
    fi
    
    if [ -z "$base_branch" ]; then
        echo "Error: Empty base branch provided" >&2
        return 1
    fi
    
    echo "Creating pull request from $head_branch to $base_branch..." >&2
    
    # Prepare command
    local cmd="gh pr create --title \"$title\" --body \"$body\" --head \"$head_branch\" --base \"$base_branch\""
    
    # Add labels if provided
    if [ ${#labels[@]} -gt 0 ]; then
        for label in "${labels[@]}"; do
            if [ -n "$label" ]; then
                cmd="$cmd --label \"$label\""
            fi
        done
    fi
    
    # Add JSON output
    cmd="$cmd --json url --jq .url"
    
    # Create PR
    local pr_url=""
    pr_url=$(eval "$cmd" 2>&1) || {
        echo "Error creating PR: $pr_url" >&2
        return 1
    }
    
    if [ -z "$pr_url" ]; then
        echo "Error: Empty PR URL returned, PR may not have been created" >&2
        return 1
    fi
    
    echo "Created pull request: $pr_url" >&2
    printf "pr_url=%s\n" "$pr_url"
    return 0
}

# Function to add reviewers
add_reviewers() {
    local pr_number=$1
    local reviewers=("${@:2}")
    
    if [ -z "$pr_number" ]; then
        echo "Error: No PR number provided" >&2
        return 1
    fi
    
    if [ ${#reviewers[@]} -gt 0 ]; then
        echo "Adding reviewers to PR #$pr_number..." >&2
        
        local reviewer_list=""
        for reviewer in "${reviewers[@]}"; do
            if [ -n "$reviewer" ]; then
                reviewer_list="$reviewer_list,$reviewer"
            fi
        done
        reviewer_list=${reviewer_list#,}
        
        if [ -n "$reviewer_list" ]; then
            gh pr edit "$pr_number" --add-reviewer "$reviewer_list" >&2 || {
                echo "Warning: Failed to add reviewers to PR #$pr_number" >&2
                return 1
            }
            echo "Successfully added reviewers: $reviewer_list" >&2
        fi
    fi
    
    return 0
}

# Function to add assignees
add_assignees() {
    local pr_number=$1
    local assignees=("${@:2}")
    
    if [ -z "$pr_number" ]; then
        echo "Error: No PR number provided" >&2
        return 1
    fi
    
    if [ ${#assignees[@]} -gt 0 ]; then
        echo "Adding assignees to PR #$pr_number..." >&2
        
        local assignees_cmd="gh pr edit \"$pr_number\""
        local has_assignees=0
        
        for assignee in "${assignees[@]}"; do
            if [ -n "$assignee" ]; then
                assignees_cmd="$assignees_cmd --add-assignee \"$assignee\""
                has_assignees=1
            fi
        done
        
        if [ $has_assignees -eq 1 ]; then
            local result=""
            result=$(eval "$assignees_cmd" 2>&1) || {
                echo "Warning: Failed to add assignees: $result" >&2
                return 1
            }
            echo "Successfully added assignees to PR #$pr_number" >&2
        else
            echo "No valid assignees to add" >&2
        fi
    fi
    
    return 0
}

# Main function
main() {
    # Parse command line arguments
    local branch_name=""
    local title=""
    local body=""
    local base_branch="main"
    local labels=()
    local reviewers=()
    local assignees=()
    local files=()
    local has_errors=0
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --branch)
                branch_name="$2"
                shift 2
                ;;
            --title)
                title="$2"
                shift 2
                ;;
            --body)
                body="$2"
                shift 2
                ;;
            --base)
                base_branch="$2"
                shift 2
                ;;
            --label)
                labels+=("$2")
                shift 2
                ;;
            --reviewer)
                reviewers+=("$2")
                shift 2
                ;;
            --assignee)
                assignees+=("$2")
                shift 2
                ;;
            --file)
                files+=("$2")
                shift 2
                ;;
            --help)
                echo "Usage: $0 --branch <branch-name> --title <title> --body <body> [--base <base-branch>] [--label <label>] [--reviewer <reviewer>] [--assignee <assignee>] [--file <file>]" >&2
                exit 0
                ;;
            *)
                echo "Unknown option: $1" >&2
                echo "Usage: $0 --branch <branch-name> --title <title> --body <body> [--base <base-branch>] [--label <label>] [--reviewer <reviewer>] [--assignee <assignee>] [--file <file>]" >&2
                exit 1
                ;;
        esac
    done
    
    # Validate required arguments
    if [ -z "$branch_name" ]; then
        echo "Error: --branch is required" >&2
        exit 1
    fi
    
    if [ -z "$title" ]; then
        echo "Error: --title is required" >&2
        exit 1
    fi
    
    if [ -z "$body" ]; then
        echo "Error: --body is required" >&2
        exit 1
    fi
    
    echo "Starting PR creation process..." >&2
    
    # Create branch
    if ! create_branch "$branch_name" "$base_branch"; then
        echo "Error: Failed to create branch $branch_name" >&2
        exit 1
    fi
    
    # Commit changes if files are specified
    if [ ${#files[@]} -gt 0 ]; then
        if ! commit_changes "$title" "${files[@]}"; then
            echo "Warning: Failed to commit changes" >&2
            has_errors=1
        fi
    fi
    
    # Push changes
    if ! push_changes "$branch_name"; then
        echo "Error: Failed to push changes to $branch_name" >&2
        exit 1
    fi
    
    # Create PR
    local pr_url=""
    pr_url=$(create_pull_request "$title" "$body" "$branch_name" "$base_branch" "${labels[@]}") || {
        echo "Error: Failed to create PR" >&2
        exit 1
    }
    
    # Extract PR number from URL
    local pr_number=$(echo "$pr_url" | grep -o '[0-9]*$')
    if [ -z "$pr_number" ]; then
        echo "Warning: Could not extract PR number from URL: $pr_url" >&2
        # Continue anyway, since the PR might have been created
    fi
    
    # Add reviewers and assignees
    if [ -n "$pr_number" ]; then
        if ! add_reviewers "$pr_number" "${reviewers[@]}"; then
            echo "Warning: Failed to add reviewers to PR #$pr_number" >&2
            has_errors=1
        fi
        
        if ! add_assignees "$pr_number" "${assignees[@]}"; then
            echo "Warning: Failed to add assignees to PR #$pr_number" >&2
            has_errors=1
        fi
    fi
    
    if [ $has_errors -eq 0 ]; then
        echo "Successfully created pull request: $pr_url" >&2
        exit 0
    else
        echo "Created pull request with some warnings: $pr_url" >&2
        exit 1
    fi
}

# Run main function with all arguments
main "$@"