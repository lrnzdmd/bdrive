# BDrive: Express File Management Application

BDrive is a web-based file management application built with Express.js, Prisma ORM, and Supabase for file storage. It allows users to upload, organize, and manage their files and folders in a cloud environment.

## Live Preview

You can try out BDrive at [https://bdrive.onrender.com/](https://bdrive.onrender.com/)

**Note:** The application is hosted on Render's free tier. If the server is inactive, it may take 1-2 minutes to start up when you first access the site.

## Features

- User authentication (signup, login, logout)
- File operations:
  - Upload
  - Download
  - Edit name
  - Delete
- Folder operations:
  - Create
  - Edit name
  - Delete (including all subfolders and files)
- File and folder browsing with pagination
- Search functionality
- Breadcrumb navigation

## Technologies Used

- Express.js
- Prisma ORM
- Supabase
- Passport.js for authentication
- Multer for file upload handling
- EJS for view templating
- bcryptjs for password hashing

## Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Set up environment variables:
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_APIKEY`: Your Supabase API key
   - `COOKIE_SECRET`: A secret string for session management
   - `DATABASE_URL`: Your PostgreSQL database URL

4. Set up Prisma:
   ```
   npx prisma generate
   npx prisma db push
   ```

5. Start the server:
   ```
   npm start
   ```

## Project Structure

- `app.js`: Main application file
- `routes/`:
  - `fileRouter.js`: Handles file operations
  - `folderRouter.js`: Handles folder operations
- `views/`: EJS templates for rendering pages
- `public/`: Static assets
- `prisma/schema.prisma`: Database schema definition

## Key Functions

- `formatFileSize()`: Formats file sizes for display
- `generateBreadcrumbs()`: Generates breadcrumb navigation
- `splitIntoPages()`: Implements pagination for file and folder lists
- `getFolderWithSubfolders()`: Recursively fetches a folder with all its subfolders
- `getAllFilesInFolder()`: Recursively gets all files in a folder and its subfolders

## File Operations

- Edit file name
- Download file (generates a signed URL)
- Delete file (removes from both Supabase storage and database)

## Folder Operations

- Edit folder name
- Delete folder (including all subfolders and files)

## Authentication

The application uses Passport.js with a Local Strategy for user authentication. Passwords are hashed using bcryptjs before storage.

## File Storage

Files are stored using Supabase storage. The application uses Multer for handling file uploads in memory before sending them to Supabase.

## Session Management

Express sessions are used for maintaining user sessions, with session data stored using PrismaSessionStore.

## Database Schema

The application uses a PostgreSQL database with the following models:

- User: Stores user information and references to their home folder
- Folder: Represents folders in the file system, with self-referential relationships for subfolders
- File: Stores file metadata and references to the parent folder and owner
- Session: Manages user sessions

## Security

- All routes check for user authentication and ownership before allowing operations
- File and folder operations are restricted to their owners

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT License](LICENSE)