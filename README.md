# SciCom Backend
The server code for the SciCom project.

## Endpoints
Developed endpoints are listed below
- /auth
  - POST /register, register
  - POST /login, login
- /user (JWT required)
  - GET /, return user's info when no params are given, search for users (available attributes: name) when there are
  - POST /:username, modify user info
  - GET /:username, retrieve user info
  - GET /\*, access user media
- /project (JWT required)
  - GET /, list users' projects when no params are given, search for projects (available attributes: title, status, nature, salary,  from,  page) when there are
  - POST /, create a new project
  - POST /:id, modify project info
  - GET  /:id, get project info
  - GET /\*, access project media
