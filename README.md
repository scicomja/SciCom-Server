# SciCom Backend
The server code for the SciCom project.

## Endpoints
Developed endpoints are listed below
- GET /constant, returns a list of constants for forms (e.g. choices for multiple-choice questions)

- /auth
  - POST /register, register
  - POST /login, login

- /user (JWT required)
  - GET /, return user's info when no params are given, search for users (available attributes: name) when there are
  - POST /:username, modify user info
  - GET /:username, retrieve user info
  	- GET /projects, retrieve projects created by this user. If he is a student, retrieve list of applications that he has been accepted.
  - GET /\*, access user media

- /project (JWT required)
  - GET /, list users' projects when no params are given, search for projects (available attributes: title, status, nature, salary,  from,  page) when there are
  - POST /, create a new project
  - POST /apply/:id, apply / un-apply for the project with given ID
  - /:id
	  - POST /, modify project info
	  - GET  /, get project info, if user is the project creator he will see extra list of applications
  - GET /\*, access project media

- /application (JWT required)
  - GET /, if user is a politician, get all applications he received; otherwise get all applications he has submitted.
  - GET /:id, get info of an application, works only if you submitted this application or you are the creator of the project this application is applying for.
  - POST /:id/accept, accept this application
  - POST /:id/reject, reject this application
