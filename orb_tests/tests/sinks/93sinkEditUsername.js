module.exports = {
    '@disabled': false,

    before: (browser) => {
      const login = browser.page.login();
      const topbar = browser.page.topbar();
      const email = 'tester@email.com';
      const pwd = '12345678';
      const maximizeWindowCallback = () => {
        console.log('Window maximized');
      };
      browser.maximizeWindow(maximizeWindowCallback);
  
      login.with(email, pwd);
      topbar.expectLoggedUser(email);
    },

    'Sink Edit Username'  : (browser) => {
    const sinks = browser.page.sinks();


    sinks
    .navigate()
    .sinkEdit()
	.click('@sinkNext')
	.sinkEditAttribute('@sinkUsername', '_n3w_usr')
	.click('@sinkNext')
	.click('@sinkNext')
	.click('@sinkNext')
	.verify.containsText('span.title', 'Sink successfully updated', "Confirmation message is being correctly displayed")
	// BUG
	//.sinkCheckEdition('_n3w_usr')

}}