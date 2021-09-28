"use strict";
const express = require("express");
const app = express();
const router = express.Router();
//const port = 3000; // Uncomment for testing locally
const { v4: uuidv4 } = require("uuid");
const AWS = require("aws-sdk");
const bodyParser = require('body-parser')
const cors = require('cors');
const { text } = require("body-parser");

var corsOptions = {
  origin: '*',
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}

router.use(express.json());
router.use(express.urlencoded({ extended: true }));
router.use(cors());
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: true }));

//uncomment for testing locally
// AWS.config.update({
//   region: "ap-southeast-2",
//   endpoint: "http://localhost:8000",
// });


const docClient = new AWS.DynamoDB.DocumentClient();

// Replace with the name of your local Dynanmodb table name
const table = "scrumblr-api-zain-ScrumblrDB-3ZBPAM1PVC7Z";

let board_id, note_id
let isNotePresent = false

const isEmpty = (obj) => {
  
  if(obj == null)
  {
 
    return false;
  }
  else 
  {
  switch (Object.keys(obj).length === 0) {
    case true:
      return true;
    case false:    
    default:
      return false;
  }
  }
}

const errorReturn = (responseStatus, message,response) => {
  response.status (responseStatus)
  response.send(JSON.stringify(message))
}

const isIdAlphaNumeric = (test_board_id) => {
  const regex = new RegExp('^[a-zA-Z0-9-]+$');
  return (regex.test(test_board_id) && test_board_id.length === 36)
}

//List all boards in memory(array)
router.get("/board", async (req, res) => {
  let params = {
    TableName: table,
  };

  let data;

  try {
    data = await docClient.scan(params).promise();
  } catch (error) {
    res.send(JSON.stringify(error));
  }
  res.status(200);
  res.send(JSON.stringify(data));
});

//Get a particular board
router.get("/board/:BoardId", async (req, res) => {

let board_id
if (!('BoardId' in req.params)){
    board_id = ""
    errorReturn(404, "BoardId is not present in parameters", res)
    return;
}
else {
    board_id = req.params.BoardId
}

switch(isIdAlphaNumeric(board_id))
{
  case false:
    errorReturn(400, "BoardId is not valid", res)
    return;
  case true:
  default:
}

let params = {
    TableName: table
}

const tableRows = await docClient.scan(params).promise();

let board = tableRows.Items.find(board => board.BoardId === board_id)
if (isEmpty(board))
{
  errorReturn(404,"No boards not found in the database", res)
  return;
}

  try {
    if(board)
    res.send(board);
  } catch (error) {
    res.send(JSON.stringify(error));
  }
});



router.options('*', cors())


// Create a new board
router.post("/board",cors(corsOptions), async (req, res) => {
  const boardId = uuidv4();
  let board_name = req.body.BoardName;
  if(isEmpty(board_name))
  {
    errorReturn(404,"Board Name is empty", res)
    return;
  }
  
  let params = {
    TableName: table,
    Item: {
      BoardId: boardId,
      BoardName: board_name,
      board_notes: [],
    },
  };

  try {
    await docClient.put(params).promise();
    let boardIdObj = {
      boardID : boardId
    }
    res.send(boardIdObj)
  } catch (error) {
    res.send(JSON.stringify(error));
  }
});

//Update the board name
router.patch("/board/:BoardId",cors(corsOptions), async (req, res) => {
  if (!('BoardId') in req.params){
    board_id = ""
    errorReturn(404, "BoardId is not present in parameters", res)
    return;
  }
  else {
    board_id = req.params.BoardId
  }

  switch(isIdAlphaNumeric(board_id))
  {
    case false:
      errorReturn(404, "BoardId isn't valid", res)
      return;
    case true : 
    default:
  }

  switch(typeof req.body.BoardName === 'string') // works
  {
    case false:
      errorReturn(404, "Board Name is not valid", res)
      return;
    case true:
    default:
  }

  let params = {
    TableName: table,
    Key:{
      BoardId: board_id
    },
    UpdateExpression: "SET BoardName = :boardName",
    ExpressionAttributeValues: {
      ":boardName": req.body.BoardName
    }
  }
  try{
    await docClient.update(params).promise();
    res.status(200)
    res.send()
  } catch (error){
    res.send(JSON.stringify(error))
  }
})

//Delete a specific board
router.delete("/board/:BoardId", async (req, res) => {
 if (!("BoardId" in req.params)) {
    board_id = "";
    errorReturn(404, "Board Id is not present in the parameters", res)
    return;
  } else {
    board_id = req.params.BoardId;
  }

  switch(isIdAlphaNumeric(board_id)) // works
  {
    case false:
      errorReturn(404, "Board Id is not valid", res)
      return;
    case true :
    default:
  }

  let params = {
    TableName: table,
  };

  let boards = await docClient.scan(params).promise();

  switch(boards.Items.length === 0)
  {
    case true:
      errorReturn(404, "No Boards found in Database", res) //works
      return;
    case false :
    default:

  }
  let params1;
  let isBoardPresent = false;
  for (let board in boards.Items) {
    if (boards.Items[board].BoardId === board_id) {
        isBoardPresent = true;
        params1 = {
          TableName: table,
          Key: {
            BoardId: board_id,
          },
        };
    }
  }

  try {
    if(isBoardPresent) {
      data = await docClient.delete(params1).promise();
      res.status(200);
      res.send();
    }
    else {
      errorReturn(404, "Board Not Found", res)
      return;
    }
  }
   catch (error) {
    res.send(JSON.stringify(error));
  }
});

// Create a note for a specified board
router.post("/board/:BoardId/note", async (req, res) => {

  // convert the below if to switch
  if (!("BoardId" in req.params)) {
    board_id = "";
  } else {
    board_id = req.params.BoardId;
  }

  switch(isIdAlphaNumeric(board_id)) {
    case false:
     errorReturn(400, "Board Id is not valid", res)
     return;
    case true:
    default:
  }

  let textForNote = req.body.singleNote;
 
  switch(typeof textForNote === 'string' && !isEmpty(textForNote)) {
    case false:
      errorReturn(400,"Topic for note is invalid", res) 
      return;
      case true:
      default:

  }

  const singleNote = {
    note_id: uuidv4(),
    topic: textForNote,
    dateCreated: Date.now(),
  };

  let params = {
    TableName: table,
  };

  let boards = await docClient.scan(params).promise();
  switch(isEmpty(boards.Items))
  {
      case true :
        errorReturn(404,"No boards found in the database", res)
        return;
      case false:
      default:
    }
    let isBoardPresent = false;
  for (let board in boards.Items) {
    if (boards.Items[board].BoardId === board_id) {
      isBoardPresent = true;
      let updateBoard = { 
        TableName: table,
        Key: {
          "BoardId": board_id,
        },
        UpdateExpression: "SET board_notes = list_append(board_notes,:note)",
        ExpressionAttributeValues: {
          ":note": [singleNote],
        },
      };
    
      try {
        await docClient.update(updateBoard).promise();
        res.send();
      } catch (error) {
        res.send(JSON.stringify(error));
      }
    }    
  }
  switch(isBoardPresent)
  {
    case false:
      errorReturn(404, "Board not found", res)
      return;
      case true:
        default:
  }
});

// Delete a particular note from a particular board
router.delete("/board/:boardId/note/:noteId", async (req, res) => {
  if (!("boardId" in req.params) && "noteId" in req.params) {
    board_id = "";
    note_id = "";
  } else {
    board_id = req.params.boardId;
    note_id = req.params.noteId;
  }
  switch(isIdAlphaNumeric(board_id) && isIdAlphaNumeric(note_id))  //doesn't work
  {
    case false:
      errorReturn(400, "Id isnt valid", res)  //works
      return;
    case true:
      default:
  }

  let params = {
    TableName: table,
    Key: {
      "BoardId": board_id,
    },
    KeyConditionExpression: "BoardId = :boardId",
    ExpressionAttributeValues: {
      ":boardId": board_id,
    },
  };
  let board
try{
   board = await docClient.query(params).promise();
}
catch(err)
{
  errorReturn(404, "Board not found", res)  
  return;
}

  switch(isEmpty(board.Items))
  {
    case true:
      errorReturn(404, "Board not present in the database", res)  //works
      return;
      case false:
        default:
  }

  let itemsFirstIndex = board.Items.find(Boolean);
  let params1;

  for (let note in itemsFirstIndex.board_notes) {
    if (itemsFirstIndex.board_notes[note].note_id === note_id) {
      isNotePresent = true;
        itemsFirstIndex.board_notes.splice(note, 1);

      params1= {
        TableName: table,
        Key: {
          "BoardId": board_id,
        },
        UpdateExpression: "SET board_notes = :board_notes_new_array",
        ExpressionAttributeValues: {
          ":board_notes_new_array": itemsFirstIndex.board_notes,
        },
      };
    } 
  }
  switch(isNotePresent)
  {
    case false:
      errorReturn(404, "Note not found", res)  //works
      return;
    case true:
    default:

  }
  try{
    await docClient.update(params1).promise();
    res.send();
  } catch {
    res.send(JSON.stringify(err))
  }
});

// Update a specific note
router.patch("/board/:boardId/note/:noteId", async (req, res) => {
  if (!("boardId" in req.params) && "noteId" in req.params) {
    note_id = "";
    board_id = "";
  } else {
    note_id = req.params.noteId;
    board_id = req.params.boardId;
  }

  switch(isIdAlphaNumeric(board_id) && isIdAlphaNumeric(note_id)) {
    case false:
      errorReturn(400, "Id is not valid", res) //works
      return;
    case true:
    default:
  }

  const textForNote = req.body.singleNote;

  switch (typeof textForNote === "string" && !isEmpty(textForNote)) {
    case false:
      errorReturn(400, "Topic is not valid", res)
    case true:
    default:
  }

  let params = {
    TableName: table,
    KeyConditionExpression: "BoardId = :boardId",
    ExpressionAttributeValues: {
      ":boardId": board_id
    },
  };

  let board = await docClient.query(params).promise();

  switch(board.Items.length === 0){
    case true:
      errorReturn(404, "Board not found", res); // crashes
      return;
    case false:
    default:
  }

  let updateNote, note

  for (note in board.Items.find(Boolean).board_notes) {
    if (board.Items.find(Boolean).board_notes[note].note_id === note_id) {
      isNotePresent = true;
      updateNote = {
        TableName: table,
        Key: {
          "BoardId": board_id,
        },
        UpdateExpression: "SET board_notes[" + note + "].topic = :noteText",
        ExpressionAttributeValues: {
          ":noteText": textForNote,
        },
      };
      break;
    }
  }

  try {
    switch(isNotePresent) {
      case true:
        await docClient.update(updateNote).promise();
        res.send();
        return;
      case false:
      default:
        errorReturn(404, "Note not found", res)
    }
  } catch (error) {
    res.send(error);
  }
});

// Get a specific note

router.get("/board/:boardId/note/:noteId", async (req, res) => {
  if (!("boardId" in req.params) && "noteId" in req.params) {
    note_id = "";
    board_id = "";
  } else {
    note_id = req.params.noteId;
    board_id = req.params.boardId;
  }

  switch(isIdAlphaNumeric(board_id) && isIdAlphaNumeric(note_id)) {
    case false:
      errorReturn(400, "Id is not valid", res)
    case true:
    default:
  }

  let params = {
    TableName: table,
    KeyConditionExpression: "BoardId = :boardId",
    ExpressionAttributeValues: {
      ":boardId": board_id,
    },
  };

  let board = await docClient.query(params).promise();

  switch(isEmpty(board)){
    case true:
      errorReturn(404, "Board not found")
    case false:
    default:
  }

  let itemsFirstIndex = board.Items.find(Boolean);

  for (let note in itemsFirstIndex.board_notes) {
    if (itemsFirstIndex.board_notes[note].note_id === note_id) {
        isNotePresent = true
        const singleNote = {
          note_id: itemsFirstIndex.board_notes[note].note_id,
          topic: itemsFirstIndex.board_notes[note].topic,
          dateCrated: itemsFirstIndex.board_notes[note].dateCrated,
        };
        try { 
          if (isNotePresent) {
            res.send(JSON.stringify(singleNote))
          } 
        } catch (error) {
            res.send(JSON.stringify(error))
        }
      }
    }
});

app.use("/", router);

// uncomment for local testing
// app.listen(port, () => {
//   console.log(`App listening at http://localhost:${port}`);
// });

module.exports = app;
