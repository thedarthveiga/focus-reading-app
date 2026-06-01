# DynamoDB Single-Table Design — FocusReading

## Table name: `focus-reading`

## Key schema

| Attribute | Type | Description |
|-----------|------|-------------|
| `PK` | String | Partition key |
| `SK` | String | Sort key |
| `GSI1PK` | String | GSI1 partition key |
| `GSI1SK` | String | GSI1 sort key |

## Entity prefixes

| Entity | PK | SK |
|--------|----|----|
| User | `USER#<id>` | `#METADATA` |
| Book | `BOOK#<id>` | `#METADATA` |
| Chapter | `BOOK#<id>` | `CHAPTER#<number>` |
| ReadingSession | `SESSION#<id>` | `#METADATA` |
| UserSession | `USER#<userId>` | `SESSION#<sessionId>` |

## Access patterns

| # | Description | Key condition |
|---|-------------|---------------|
| 1 | Get user by ID | `PK = USER#<id>` AND `SK = #METADATA` |
| 2 | Get book by ID | `PK = BOOK#<id>` AND `SK = #METADATA` |
| 3 | Get all chapters of a book | `PK = BOOK#<id>` AND `SK begins_with CHAPTER#` |
| 4 | Get book + all chapters | `PK = BOOK#<id>` |
| 5 | Get session by ID | `PK = SESSION#<id>` AND `SK = #METADATA` |
| 6 | Get all sessions of a user | `PK = USER#<userId>` AND `SK begins_with SESSION#` |
| 7 | Find books by title (GSI1) | `GSI1PK = BOOK_TITLE` AND `GSI1SK begins_with <title>` |

## Item shapes

### User
```json
{
  "PK": "USER#u-123",
  "SK": "#METADATA",
  "entityType": "USER",
  "id": "u-123",
  "email": "reader@example.com",
  "wpmValue": 250,
  "wpmCalibratedAt": "2024-01-01T00:00:00.000Z",
  "wpmSampleCount": 3,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### Book
```json
{
  "PK": "BOOK#b-456",
  "SK": "#METADATA",
  "GSI1PK": "BOOK_TITLE",
  "GSI1SK": "atomic habits",
  "entityType": "BOOK",
  "id": "b-456",
  "title": "Atomic Habits",
  "author": "James Clear",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### Chapter (stored separately for efficient access pattern #3)
```json
{
  "PK": "BOOK#b-456",
  "SK": "CHAPTER#001",
  "entityType": "CHAPTER",
  "bookId": "b-456",
  "number": 1,
  "title": "The Surprising Power of Atomic Habits",
  "wordCount": 4500,
  "mood": "calm"
}
```

### ReadingSession
```json
{
  "PK": "SESSION#s-789",
  "SK": "#METADATA",
  "entityType": "SESSION",
  "id": "s-789",
  "userId": "u-123",
  "bookId": "b-456",
  "chapterNumber": 1,
  "estimatedDurationMinutes": 22,
  "spotifyPlaylistId": "37i9dQZF1DX8NTLI2TtZa6",
  "focusType": "alpha-waves",
  "status": "pending",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```
