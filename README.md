# SciCom Backend
The server code for the SciCom project.

## Endpoints
Developed endpoints are listed below
- /auth
  - POST /register, register
  - POST /login, login
- /user (JWT required)
  - POST /:username, modify user info
  - GET /:username, retrieve user info
  - GET /\*, access user media
- /project (JWT required)
  - GET /, search for projects (available attributes: title, status, nature, salary,  from,  page)
  - POST /, create a new project
  - POST /:id, modify project info
  - GET  /:id, get project info
  - GET /\*, access project media
