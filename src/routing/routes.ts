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
  UserInfo = '/user-info',
  Email = '/email',
  Code = '/code',
  Password = '/password'
}
