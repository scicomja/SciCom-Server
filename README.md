# SciCom Backend
The server code for the SciCom project.

[![Maintainability](https://api.codeclimate.com/v1/badges/01c090f8ca023699816d/maintainability)](https://codeclimate.com/github/travistang/SciCom-Server/maintainability)
[![Test Coverage](https://api.codeclimate.com/v1/badges/01c090f8ca023699816d/test_coverage)](https://codeclimate.com/github/travistang/SciCom-Server/test_coverage)

## Endpoints
Developed endpoints are listed below
- GET /constant, returns a list of constants for forms (e.g. choices for multiple-choice questions)

- /auth
  - POST /register, register
  - POST /login, login

- /user (JWT required)
  - GET /, return user's info when no params are given, search for users (available attributes: name) when there are
  - POST /, modify user info
  - DELETE /, delete this account. All the projects he is involved in and 
  - GET /:username, retrieve user info
  	- GET /projects, retrieve projects created by this user. If he is a student, retrieve list of applications that he has been accepted.
  - GET /\*, access user media

- /project (JWT required)
  - GET /, list users' projects when no params are given, search for projects (available attributes: title, status, nature, salary,  from,  page) when there are
  - POST /, create a new project
  - POST /complete/:id, mark project as completed. Only works if you are the owner of the project and the status of the project is "closed".
  - POST /bookmark/:id, bookmark / un-bookmark project with given ID
  - POST /open/:id, (re)open this project, only project creator can do it
  - POST /close/:id, close this project, only project creator can do it
  - POST /apply/:id, apply / un-apply for the project with given ID
  - /:id
	  - POST /, modify project info
	  - GET  /, get project info, if user is the project creator he will see extra list of applications
	  - DELETE /, delete this project. Only project creator can do this.
  - GET /\*, access project media

- /application (JWT required)
  - GET /, if user is a politician, get all applications he received; otherwise get all applications he has submitted.
  - GET /:id, get info of an application, works only if you submitted this application or you are the creator of the project this application is applying for.
  - POST /:id/accept, accept this application
  - POST /:id/reject, reject this application
