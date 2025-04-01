export enum Routes {
  // Pages
  Home = '/',
  Projects = '/projects',
  Project = '/project/:id',
  ProjectDefault = '/project/default',

  // Endpoints
  Login = '/oauth2/authorization/sso',
  Logout = '/logout',
  FormLogin = '/formlogin',
  UserInfo = '/api/v2/public/user-info',
  Email = '/api/v2/public/email',
  Code = '/api/v2/public/code',
  Password = '/api/v2/public/password'
}
