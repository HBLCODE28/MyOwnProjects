'use strict';

const LEGAL_ENGLISH_TEXT = {
  privacy: {
    title: 'Privacy policy | SharedCart',
    heading: 'Privacy policy',
    paragraphs: [
      'SharedCart stores the account details you provide: username, email address, and content you add to groups, such as items, comments, and photos.',
      'This information is used to run groups, identify users, reset passwords, and keep list history. Only group members can see group content. Kitchen status photos are available only to group members.',
      'We do not sell personal information. Hosting and email services may process the information needed to operate the service.',
      'To delete an account or ask a privacy question, contact support at sharedcartmail2@gmail.com. This policy will be updated when we add services or sharing options.'
    ]
  },
  terms: {
    title: 'Terms of use | SharedCart',
    heading: 'Terms of use',
    paragraphs: [
      'SharedCart is intended for managing shared lists. Use it lawfully and respectfully, without uploading harmful content or other people’s personal information without permission.',
      'A group creator and its managers are responsible for who joins the group and for its shared content. Do not share invitation links outside the appropriate circle.',
      'The service is provided as is. We may update it or remove content that breaks the rules to help keep users safe.'
    ]
  }
};

if (localStorage.getItem('cg_language') === 'en') {
  const page = LEGAL_ENGLISH_TEXT[document.body.dataset.legalPage];
  if (page) {
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
    document.title = page.title;
    document.querySelector('.auth-title').textContent = page.heading;
    document.querySelectorAll('.legal-card p').forEach((element, index) => {
      if (page.paragraphs[index]) element.textContent = page.paragraphs[index];
    });
    if (document.body.dataset.legalPage === 'privacy') {
      const support = document.querySelector('.legal-card p:last-of-type');
      const email = document.createElement('a');
      email.href = 'mailto:sharedcartmail2@gmail.com';
      email.textContent = 'sharedcartmail2@gmail.com';
      support.textContent = 'To delete an account or ask a privacy question, contact support at ';
      support.append(email, '. This policy will be updated when we add services or sharing options.');
    }
    document.querySelector('.legal-back-button').textContent = 'Back to SharedCart';
  }
}
