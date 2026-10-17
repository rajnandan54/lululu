import { readBlockConfig } from '../../scripts/aem.js';
import {
  getUser, setUser, clearUser, identityMapFor, sendXdmEvent,
} from '../../scripts/user.js';

// Supabase project (free Postgres). The anon key is public by design; access is enforced by RLS.
const SUPABASE_URL = 'https://xhzgosjswlazhsolvatj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_rlIyOiqiwHDG_3crmaI_Rw_OpH8M_i2';

const GENDERS = [
  ['not_specified', 'Prefer not to say'],
  ['female', 'Female'],
  ['male', 'Male'],
  ['non_specific', 'Non-specific'],
];

const MARITAL_STATUSES = [
  ['not_specified', 'Prefer not to say'],
  ['single', 'Single'],
  ['married', 'Married'],
  ['divorced', 'Divorced'],
  ['widowed', 'Widowed'],
];

const COURTESY_TITLES = [['', '—'], ['Mr', 'Mr'], ['Ms', 'Ms'], ['Mrs', 'Mrs'], ['Mx', 'Mx'], ['Dr', 'Dr']];

const PROFILE_FIELDS = [
  'courtesyTitle', 'firstName', 'middleName', 'lastName', 'suffix',
  'birthDate', 'gender', 'maritalStatus', 'nationality',
];

async function supabaseAuth(path, body) {
  const resp = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(json.error_description || json.msg || json.message || 'Request failed');
  return json;
}

/**
 * Maps a stored profile to the XDM `person` field group; empty values are omitted.
 */
function toXdmPerson(p = {}) {
  const name = {
    courtesyTitle: p.courtesyTitle,
    firstName: p.firstName,
    middleName: p.middleName,
    lastName: p.lastName,
    suffix: p.suffix,
    fullName: [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' '),
  };
  const person = {
    name: Object.fromEntries(Object.entries(name).filter(([, v]) => v)),
    gender: p.gender || undefined,
    maritalStatus: p.maritalStatus || undefined,
    nationality: p.nationality || undefined,
    type: 'B2C',
  };
  if (p.birthDate) {
    person.birthDate = p.birthDate;
    person.birthYear = Number(p.birthDate.slice(0, 4));
    person.birthDayAndMonth = p.birthDate.slice(5);
  }
  return Object.fromEntries(Object.entries(person).filter(([, v]) => v !== undefined));
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'text') node.textContent = v;
    else if (v === true) node.setAttribute(k, '');
    else if (v !== false && v != null) node.setAttribute(k, v);
  });
  node.append(...children);
  return node;
}

function field(label, attrs) {
  const id = `login-${attrs.name}-${Math.random().toString(36).slice(2, 7)}`;
  const control = attrs.options
    ? el('select', { id, name: attrs.name }, attrs.options.map(([value, text]) => el('option', { value, text })))
    : el('input', { id, ...attrs });
  return el('div', { class: 'login-field' }, [el('label', { for: id, text: label }), control]);
}

function buildLoginForm() {
  return el('form', { class: 'login-form', 'data-mode': 'login' }, [
    field('Email', {
      name: 'email', type: 'email', autocomplete: 'email', required: true,
    }),
    field('Password', {
      name: 'password', type: 'password', autocomplete: 'current-password', required: true,
    }),
    el('button', { type: 'submit', class: 'button primary', text: 'Sign in' }),
  ]);
}

function buildRegisterForm() {
  return el('form', { class: 'login-form', 'data-mode': 'register', hidden: true }, [
    el('div', { class: 'login-row' }, [
      field('Title', { name: 'courtesyTitle', options: COURTESY_TITLES }),
      field('First name', {
        name: 'firstName', autocomplete: 'given-name', required: true, maxlength: 100,
      }),
    ]),
    el('div', { class: 'login-row' }, [
      field('Middle name', {
        name: 'middleName', autocomplete: 'additional-name', maxlength: 100,
      }),
      field('Last name', {
        name: 'lastName', autocomplete: 'family-name', required: true, maxlength: 100,
      }),
    ]),
    field('Suffix', {
      name: 'suffix', autocomplete: 'honorific-suffix', maxlength: 20, placeholder: 'Jr., III',
    }),
    field('Email', {
      name: 'email', type: 'email', autocomplete: 'email', required: true,
    }),
    field('Password', {
      name: 'password', type: 'password', autocomplete: 'new-password', required: true, minlength: 8,
    }),
    el('div', { class: 'login-row' }, [
      field('Date of birth', { name: 'birthDate', type: 'date', autocomplete: 'bday' }),
      field('Gender', { name: 'gender', options: GENDERS }),
    ]),
    el('div', { class: 'login-row' }, [
      field('Marital status', { name: 'maritalStatus', options: MARITAL_STATUSES }),
      field('Nationality (ISO code)', {
        name: 'nationality', maxlength: 2, pattern: '[A-Za-z]{2}', placeholder: 'US', autocomplete: 'country',
      }),
    ]),
    el('button', { type: 'submit', class: 'button primary', text: 'Create account' }),
  ]);
}

async function handleRegister(data) {
  const profile = Object.fromEntries(PROFILE_FIELDS
    .map((key) => [key, (data[key] || '').trim()])
    .filter(([, v]) => v));
  if (profile.nationality) profile.nationality = profile.nationality.toUpperCase();

  await supabaseAuth('signup', {
    email: data.email,
    password: data.password,
    data: profile,
  });
  const user = { email: data.email, firstName: profile.firstName, lastName: profile.lastName };
  sendXdmEvent({
    eventType: 'userAccount.signup',
    producedBy: 'self',
    identityMap: identityMapFor(user),
    person: toXdmPerson(profile),
  });
  return user;
}

async function handleLogin(data) {
  const json = await supabaseAuth('token?grant_type=password', {
    email: data.email,
    password: data.password,
  });
  const meta = json.user?.user_metadata || {};
  const user = {
    email: json.user?.email || data.email,
    firstName: meta.firstName || '',
    lastName: meta.lastName || '',
  };
  sendXdmEvent({
    eventType: 'userAccount.login',
    producedBy: 'self',
    identityMap: identityMapFor(user),
    person: toXdmPerson(meta),
  });
  return user;
}

function renderLoggedIn(block, user, onLogout) {
  const logout = el('button', { type: 'button', class: 'button secondary', text: 'Sign out' });
  logout.addEventListener('click', onLogout);
  block.replaceChildren(el('div', { class: 'login-welcome' }, [
    el('p', { text: `Welcome, ${user.firstName || user.email}` }),
    logout,
  ]));
}

export default function decorate(block) {
  const config = readBlockConfig(block);
  const redirect = config.redirect || '';

  const renderForms = () => {
    const loginForm = buildLoginForm();
    const registerForm = buildRegisterForm();
    const forms = [loginForm, registerForm];
    const status = el('p', { class: 'login-status', role: 'status', 'aria-live': 'polite' });

    const tabs = el('div', { class: 'login-tabs', role: 'tablist' }, [
      el('button', {
        type: 'button', role: 'tab', 'data-mode': 'login', 'aria-selected': 'true', text: 'Sign in',
      }),
      el('button', {
        type: 'button', role: 'tab', 'data-mode': 'register', 'aria-selected': 'false', text: 'Register',
      }),
    ]);
    tabs.addEventListener('click', (e) => {
      const tab = e.target.closest('[role="tab"]');
      if (!tab) return;
      tabs.querySelectorAll('[role="tab"]').forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
      forms.forEach((f) => { f.hidden = f.dataset.mode !== tab.dataset.mode; });
      status.textContent = '';
    });

    forms.forEach((form) => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!form.reportValidity()) return;
        const submit = form.querySelector('[type="submit"]');
        submit.disabled = true;
        status.textContent = '';
        status.classList.remove('error');
        try {
          const data = Object.fromEntries(new FormData(form));
          data.email = data.email.trim().toLowerCase();
          const user = form.dataset.mode === 'register'
            ? await handleRegister(data)
            : await handleLogin(data);
          setUser(user);
          if (redirect) {
            window.location.assign(new URL(redirect, window.location.origin).pathname);
          } else {
            // eslint-disable-next-line no-use-before-define
            renderLoggedIn(block, user, onLogout);
          }
        } catch (error) {
          status.textContent = error.message;
          status.classList.add('error');
        } finally {
          submit.disabled = false;
        }
      });
    });

    block.replaceChildren(tabs, ...forms, status);
  };

  function onLogout() {
    const user = getUser();
    if (user) {
      sendXdmEvent({
        eventType: 'userAccount.logout',
        identityMap: {
          Email: [{ id: user.email, authenticatedState: 'loggedOut', primary: false }],
        },
      });
    }
    clearUser();
    renderForms();
  }

  const user = getUser();
  if (user) renderLoggedIn(block, user, onLogout);
  else renderForms();
}
