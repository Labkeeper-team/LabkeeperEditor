export enum Routes {
    // Pages
    Home = '/',
    Projects = '/projects',
    NewProject = '/projects/new',
    Tokens = '/tokens',
    Pay = '/pay',
    Project = '/project/:id',
    // агентский режим: только агент и собранный PDF, редактора нет
    ProjectAgent = '/project/:id/agent',
    ProjectDefault = '/project/default',

    // Oauth2
    CodePage = '/oauth2/code',
    QrPage = '/qr/:version',
}
