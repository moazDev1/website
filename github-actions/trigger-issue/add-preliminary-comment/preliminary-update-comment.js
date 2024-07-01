// Import modules
const fs = require("fs");
const postComment = require('../../utils/post-issue-comment');
const formatComment = require('../../utils/format-comment');
const getTimeline = require('../../utils/get-timeline');

// Global variables
var github;
var context;

/**
 * @description - This function is the entry point into the javascript file, it formats the md file based on the result of the previous step and then posts it to the issue
 * @param {Object} g - GitHub object
 * @param {Object} c - context object
 * @param {Boolean} actionResult - the previous gh-action's result
 * @param {Number} issueNum - the number of the issue where the post will be made
 */
async function main({ g, c }, { shouldPost, issueNum }) {
  try {
    github = g;
    context = c;
    
    // Get the lates developer in case there are multiple assignees
    assignee = await getLatestAssignee();
    
    // If the previous action returns false, stop here
    // if(shouldPost === false)
    //   return;

    // Check if developer is allowed to work on this issue
    const isAdminOrMerge = await memberOfAdminOrMergeTeam();
    const isAssignedToAnotherIssues = await assignedToAnotherIssue();

    // If developer is not in Admin or Merge Teams
    // and assigned to another issue/s, do the following:
    if(!isAdminOrMerge && isAssignedToAnotherIssues) {

      // Create and post a comment using the template in this file
      const fileName = "multiple-issue-reminder.md";
      const filePath = './github-actions/trigger-issue/add-preliminary-comment/' + fileName;
      const unAssigningComment = createComment(filePath);
      await postComment(issueNum, unAssigningComment, github, context);
      
      await unAssignDev(); // Unassign the developer
      await addLabel(READY_FOR_DEV_LABEL); // Add 'ready for dev lead' label
      
      // Update item status to "New Issue Approval"
      const item = await getItemInfo();
      await updateItemStatus(item.id, statusesValues.get(New_Issue_Approval));
    }
    // Otherwise, post the normal comment
    else {
      const instructions = await makeComment();
      if(instructions !== null){
        // the actual creation of the comment in github
        await postComment(issueNum, instructions, github, context);

        // Update item status to "In progress (actively working)"
        const item = await getItemInfo();
        await updateItemStatus(item.id, statusesValues.get(In_Progress));
      }
    }
  } catch (error) {
    console.log(error);

  }
  // Else we make the comment with the issue creator's GitHub handle instead of the placeholder
  else {
    const instructions = await makeComment();
    if (instructions !== null) {
      // The actual creation of the comment in GitHub
      await postComment(issueNum, instructions, github, context);
    }
  }
}

/**
 * @description - This function makes the comment with the issue assignee's GitHub handle using the raw preliminary.md file
 * @returns {string} - Comment to be posted with the issue assignee's name in it!!!
 */
async function makeComment() {
  // Setting all the variables which formatComment is to be called with
  let issueAssignee = context.payload.issue.assignee.login;
  let filename = 'preliminary-update.md';
  const eventdescriptions = await getTimeline(context.payload.issue.number, github, context);

  // Adding the code to find out the latest person assigned the issue
  for (var i = eventdescriptions.length - 1 ; i>=0; i-=1) {
    if (eventdescriptions[i].event == 'assigned') {
      issueAssignee = eventdescriptions[i].assignee.login;
      break;
    }
  }

  // BELOW through line 89 +/-, disabling the 'column' checks becaues these are not compatible
  // with Projects Beta. This code needs to be refactored using GraphQL, ProjectsV2, and 'status' field.
  /*
  // Getting the issue's Project Board column name
  const queryColumn = `query($owner:String!, $name:String!, $number:Int!) {
    repository(owner:$owner, name:$name) {
      issue(number:$number) {
        projectCards { nodes { column { name } } }
      }
    }
  }`;
  const variables = {
    owner: context.repo.owner,
    name: context.repo.repo,
    number: context.payload.issue.number
  };
  const resColumn = await github.graphql(queryColumn, variables);
  const columnName = resColumn.repository.issue.projectCards.nodes[0].column.name;
  const isPrework = context.payload.issue.labels.find((label) => label.name == 'Complexity: Prework') ? true : false;
  const isDraft = context.payload.issue.labels.find((label) => label.name == 'Draft') ? true : false;

  if (columnName == 'New Issue Approval' && !isDraft && !isPrework) {
    // If author == assignee, remind them to add `Draft` label, otherwise unnasign and comment
    if (context.payload.issue.user.login == issueAssignee) {
      filename = 'draft-label-reminder.md';
    } else {
      filename = 'unassign-from-NIA.md';

      await github.rest.issues.removeAssignees({
        owner: variables.owner,
        repo: variables.name,
        issue_number: variables.number,
        assignees: [issueAssignee],
      });
    }
  }
  */

  let filePathToFormat = './github-actions/trigger-issue/add-preliminary-comment/' + filename;
  const commentObject = {
    replacementString: issueAssignee,
    placeholderString: '${issueAssignee}',
    filePathToFormat: filePathToFormat,
    textToFormat: null
  };

  // Creating the comment with issue assignee's name and returning it!
  const commentWithIssueAssignee = formatComment(commentObject, fs);
  return commentWithIssueAssignee;
}
  
module.exports = main;
