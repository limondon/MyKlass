import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import {
  selectLegacyCompatibleSubscription,
  validateLegacyLessonStatusChange,
} from './profile/subscription-profile.js';
import { selectParentCardData } from './parent/parent-card.js';
import {
  createSessionFromScheduleBlock,
  findLessonIndexForSession,
} from './schedule/session.js';
import {
  attendanceMarkToLegacyChange,
  selectAttendanceJournal,
  summarizeAttendance,
} from './attendance/journal.js';
import { createAppStore } from './data/app-store.js';
import {
  createBackupDocument,
  createBackupFilename,
  parseBackupDocument,
} from './data/backup.js';
import { createDataRepository } from './data/repository-factory.js';
import { createFirebaseAuthController } from './firebase/auth.js';
import { getFirebaseRuntimeConfig } from './firebase/config.js';
import {
  publishPublicParentCard,
  readPublicParentCard,
  revokePublicParentCard,
} from './firebase/public-cards.js';
import {
  createParentAccessToken,
  createPublicParentCard,
  publicCardToLegacyStudent,
} from './parent/public-card.js';
import { ensureV2Migration, readLegacyBackup } from './storage/index.js';

// ---- Legacy section 1 ----
// ЕнотПомогун — единое хранилище данных
// При первом запуске берёт демо-данные, всё дальнейшее сохраняется в localStorage

const MK_LS_KEY = 'mk_store_v1';
const MK_OVR_KEY = 'mk.schedule.overrides';
const MK_PROFILE_KEY = 'mk.profile';
const DEFAULT_TEACHER_PROFILE = {
  name: 'Анна Сергеевна',
  role: 'репетитор',
  timezone: 'Москва · GMT+3',
  defaultPrice: 1600,
  paymentUrl: '',
};

const readLegacyScheduleOverrides = () => {
  try {
    return JSON.parse(window.localStorage.getItem(MK_OVR_KEY) || '{}') || {};
  } catch {
    return {};
  }
};

const readLegacyTeacherProfile = () => {
  try {
    return {
      ...DEFAULT_TEACHER_PROFILE,
      ...(JSON.parse(window.localStorage.getItem(MK_PROFILE_KEY) || 'null') || {}),
    };
  } catch {
    return { ...DEFAULT_TEACHER_PROFILE };
  }
};

const DEMO_STUDENTS = (() => {
  const spines = ['#1F3A2E','#9B6B2F','#7A4A2E','#3E5F4B','#2C5F77','#5A4B7C','#8C4A4A','#6B6024','#4A6B3E','#7C5A2E','#3D4F7A','#5E3D6B'];
  return [
    // s1 Лиза — середина пакета, активный, есть заметка
    { id:'s1',  name:'Лиза Морозова',   short:'Лиза М.',  birthDate:'15.03.2020', groupId:'g1', pack:8,  used:4, parent:'Ольга Морозова',    phone:'+7 916 200 14 22', joined:'Сен 2025', spine:spines[0],  scores:{Чтение:78,Математика:64,Письмо:52,Логика:81}, notes:'Очень любопытная, тянется к чтению. Дома мало читает вслух.', days:[1,3,5], time:'09:00', price:9600, paid:'15.05.2026', freezeUsed:0, freezeMax:3, status:'active', lessons:[
      {date:'15.05',status:'done',note:''},{date:'18.05',status:'done',note:''},{date:'20.05',status:'done',note:''},{date:'22.05',status:'done',note:''},
      {date:'25.05',status:'future',note:''},{date:'27.05',status:'future',note:''},{date:'29.05',status:'future',note:''},{date:'01.06',status:'future',note:''}
    ], events:[
      {type:'payment',date:'15.05.2026',note:'Оплата · 8 занятий — 9 600 ₽ · СБП'}
    ], notesList:[
      {date:'22 МАЯ', tag:'наблюдение', text:'Дочитала Букварь до буквы Я. Идём к коротким текстам вслух.'}
    ] },

    // s2 Артём — только начал новый пакет, болеет
    { id:'s2',  name:'Артём Соколов',   short:'Артём С.', birthDate:'22.06.2021', groupId:'g1', pack:6,  used:1, parent:'Мария Соколова',    phone:'+7 925 411 09 03', joined:'Окт 2025', spine:spines[1],  scores:{Чтение:42,Математика:58,Письмо:38,Логика:49}, notes:'', days:[1,3,5], time:'09:00', price:7200, paid:'22.05.2026', freezeUsed:0, freezeMax:3, status:'active', lessons:[
      {date:'22.05',status:'done',note:''},
      {date:'25.05',status:'sick-wait',note:'болеет, ждём справку'},
      {date:'27.05',status:'future',note:''},{date:'29.05',status:'future',note:''},{date:'01.06',status:'future',note:''},{date:'03.06',status:'future',note:''}
    ], events:[
      {type:'payment',date:'22.05.2026',note:'Оплата · 6 занятий — 7 200 ₽ · СБП'},
      {type:'sick-wait',date:'25.05.2026',note:'Жду справку (25.05)'}
    ] },

    // s3 Маша — заканчивает пакет, есть заметка
    { id:'s3',  name:'Маша Иванова',    short:'Маша И.',  birthDate:'08.09.2018', groupId:'g2', pack:8,  used:5, parent:'Анна Иванова',      phone:'+7 903 822 51 30', joined:'Сен 2025', spine:spines[2],  scores:{Чтение:88,Математика:79,Письмо:71,Логика:84}, notes:'', days:[2,4], time:'14:00', price:9600, paid:'05.05.2026', freezeUsed:0, freezeMax:3, status:'active', lessons:[
      {date:'07.05',status:'done',note:''},{date:'12.05',status:'done',note:''},{date:'14.05',status:'done',note:''},{date:'19.05',status:'done',note:''},{date:'21.05',status:'done',note:''},
      {date:'26.05',status:'future',note:''},{date:'28.05',status:'future',note:''},{date:'02.06',status:'future',note:''}
    ], events:[
      {type:'payment',date:'05.05.2026',note:'Оплата · 8 занятий — 9 600 ₽ · Карта'}
    ], notesList:[
      {date:'21 МАЯ', tag:'программа', text:'Сильная по математике. Можно давать задачи на класс выше.'}
    ] },

    // s4 Даня — пакет закрыт месяц назад, ждёт нового
    { id:'s4',  name:'Даня Петров',     short:'Даня П.',  birthDate:'30.05.2020', groupId:'g3', pack:6,  used:6, parent:'Игорь Петров',      phone:'+7 985 113 76 41', joined:'Сен 2025', spine:spines[3],  scores:{Чтение:64,Математика:71,Письмо:60,Логика:68}, notes:'', days:[1,3], time:'16:00', price:7200, paid:'06.04.2026', freezeUsed:0, freezeMax:3, status:'ended',  lessons:[
      {date:'06.04',status:'done',note:''},{date:'08.04',status:'done',note:''},{date:'13.04',status:'done',note:''},{date:'15.04',status:'done',note:''},{date:'20.04',status:'done',note:''},{date:'22.04',status:'done',note:''}
    ], events:[
      {type:'payment',date:'06.04.2026',note:'Оплата · 6 занятий — 7 200 ₽ · Карта'}
    ] },

    // s5 Соня — недавно записалась, маленький пакет
    { id:'s5',  name:'Соня Кузнецова',  short:'Соня К.',  birthDate:'14.11.2020', groupId:'g1', pack:4,  used:1, parent:'Татьяна Кузнецова', phone:'+7 916 543 11 09', joined:'Ноя 2025', spine:spines[4],  scores:{Чтение:35,Математика:41,Письмо:28,Логика:39}, notes:'', days:[1,3,5], time:'09:00', price:4800, paid:'22.05.2026', freezeUsed:0, freezeMax:3, status:'active', lessons:[
      {date:'22.05',status:'done',note:''},
      {date:'25.05',status:'future',note:''},{date:'27.05',status:'future',note:''},{date:'29.05',status:'future',note:''}
    ], events:[
      {type:'payment',date:'22.05.2026',note:'Оплата · 4 занятия — 4 800 ₽ · СБП'}
    ] },

    // s6 Тима — суббота, наличные, использовал заморозку
    { id:'s6',  name:'Тимофей Зайцев',  short:'Тима З.',  birthDate:'02.08.2019', groupId:'g4', pack:8,  used:5, parent:'Елена Зайцева',    phone:'+7 926 088 23 17', joined:'Сен 2025', spine:spines[5],  scores:{Чтение:56,Математика:82,Письмо:49,Логика:76}, notes:'', days:[6], time:'11:00', price:9600, paid:'18.04.2026', freezeUsed:1, freezeMax:3, status:'active', lessons:[
      {date:'18.04',status:'done',note:''},{date:'25.04',status:'done',note:''},
      {date:'02.05',status:'freeze',note:'отпуск 1 неделя'},
      {date:'09.05',status:'done',note:''},{date:'16.05',status:'done',note:''},{date:'23.05',status:'done',note:''},
      {date:'30.05',status:'future',note:''},{date:'06.06',status:'future',note:''}
    ], events:[
      {type:'payment',date:'18.04.2026',note:'Оплата · 8 занятий — 9 600 ₽ · Наличные'},
      {type:'freeze',date:'02.05.2026',note:'Заморожено (02.05)'}
    ] },

    // s7 Поля — пакет почти закончен, в зоне алертов
    { id:'s7',  name:'Полина Орлова',   short:'Поля О.',  birthDate:'17.01.2019', groupId:'g2', pack:6,  used:5, parent:'Светлана Орлова',  phone:'+7 916 765 41 02', joined:'Авг 2025', spine:spines[6],  scores:{Чтение:92,Математика:86,Письмо:88,Логика:90}, notes:'', days:[2,4], time:'14:00', price:7200, paid:'05.05.2026', freezeUsed:0, freezeMax:3, status:'active', lessons:[
      {date:'07.05',status:'done',note:''},{date:'12.05',status:'done',note:''},{date:'14.05',status:'done',note:''},{date:'19.05',status:'done',note:''},{date:'21.05',status:'done',note:''},
      {date:'26.05',status:'future',note:''}
    ], events:[
      {type:'payment',date:'05.05.2026',note:'Оплата · 6 занятий — 7 200 ₽ · СБП'}
    ], notesList:[
      {date:'21 МАЯ', tag:'программа', text:'Сильная ученица, скоро перейдём на программу для 1 класса.'}
    ] },

    // s8 Миша — индивидуальные, пакет закрыт, нужно продлевать
    { id:'s8',  name:'Миша Васильев',   short:'Миша В.',  birthDate:'25.07.2021', groupId:'g5', pack:8,  used:8, parent:'Дмитрий Васильев', phone:'+7 903 219 60 75', joined:'Окт 2025', spine:spines[7],  scores:{Чтение:51,Математика:60,Письмо:44,Логика:55}, notes:'', days:[2,6], time:'11:00', price:9600, paid:'01.04.2026', freezeUsed:0, freezeMax:3, status:'ended',  lessons:[
      {date:'01.04',status:'done',note:''},{date:'05.04',status:'done',note:''},{date:'08.04',status:'done',note:''},{date:'12.04',status:'done',note:''},{date:'15.04',status:'done',note:''},{date:'19.04',status:'done',note:''},{date:'22.04',status:'done',note:''},{date:'26.04',status:'done',note:''}
    ], events:[
      {type:'payment',date:'01.04.2026',note:'Оплата · 8 занятий — 12 800 ₽ · Карта'}
    ] },

    // s9 Кира — был перенос с отработкой, активный
    { id:'s9',  name:'Кира Новикова',   short:'Кира Н.',  birthDate:'11.04.2020', groupId:'g3', pack:6,  used:2, parent:'Алина Новикова',   phone:'+7 925 332 18 04', joined:'Сен 2025', spine:spines[8],  scores:{Чтение:73,Математика:65,Письмо:70,Логика:72}, notes:'', days:[1,3], time:'16:00', price:7200, paid:'11.05.2026', freezeUsed:0, freezeMax:3, status:'active', lessons:[
      {date:'11.05',status:'done',note:''},{date:'13.05',status:'done',note:''},
      {date:'18.05',status:'sick',note:'перенос на 20.05'},
      {date:'20.05',status:'transfer',note:'отработка пропуска 18.05'},
      {date:'25.05',status:'future',note:''},{date:'27.05',status:'future',note:''}
    ], events:[
      {type:'payment',date:'11.05.2026',note:'Оплата · 6 занятий — 7 200 ₽ · СБП'},
      {type:'sick',date:'18.05.2026',note:'Болезнь — перенос (18.05)'},
      {type:'transfer',date:'20.05.2026',note:'Отработка (20.05) → 18.05'}
    ] },

    // s10 Гриша — недавно начал, маленький пакет
    { id:'s10', name:'Гриша Смирнов',   short:'Гриша С.', birthDate:'28.02.2019', groupId:'g2', pack:4,  used:2, parent:'Наталья Смирнова', phone:'+7 916 045 99 12', joined:'Янв 2026', spine:spines[9],  scores:{Чтение:60,Математика:78,Письмо:55,Логика:70}, notes:'', days:[2,4], time:'14:00', price:4800, paid:'19.05.2026', freezeUsed:0, freezeMax:3, status:'active', lessons:[
      {date:'19.05',status:'done',note:''},{date:'21.05',status:'done',note:''},
      {date:'26.05',status:'future',note:''},{date:'28.05',status:'future',note:''}
    ], events:[
      {type:'payment',date:'19.05.2026',note:'Оплата · 4 занятия — 6 400 ₽ · СБП'}
    ] },

    // s11 Алиса — ОЖИДАЕТ оплату нового пакета (демо для payment-pending)
    { id:'s11', name:'Алиса Романова',  short:'Алиса Р.', birthDate:'03.06.2020', groupId:'g1', pack:8,  used:5, parent:'Юлия Романова',    phone:'+7 926 711 23 88', joined:'Сен 2025', spine:spines[10], scores:{Чтение:80,Математика:72,Письмо:76,Логика:78}, notes:'', days:[1,3,5], time:'09:00', price:9600, paid:'13.05.2026', freezeUsed:0, freezeMax:3, status:'active', lessons:[
      {date:'13.05',status:'done',note:''},{date:'15.05',status:'done',note:''},{date:'18.05',status:'done',note:''},{date:'20.05',status:'done',note:''},{date:'22.05',status:'done',note:''},
      {date:'25.05',status:'future',note:''},{date:'27.05',status:'future',note:''},{date:'29.05',status:'future',note:''}
    ], events:[
      {type:'payment',date:'13.05.2026',note:'Оплата · 8 занятий — 9 600 ₽ · Карта'},
      {type:'payment-pending',date:'25.05.2026',note:'Ждёт оплаты · 8 занятий — 9 600 ₽'}
    ] },

    // s12 Лёва — индивидуальные, пакет до начала июня
    { id:'s12', name:'Лев Фёдоров',     short:'Лёва Ф.',  birthDate:'19.09.2020', groupId:'g5', pack:6,  used:3, parent:'Кирилл Фёдоров',  phone:'+7 903 555 24 16', joined:'Ноя 2025', spine:spines[11], scores:{Чтение:47,Математика:53,Письмо:41,Логика:48}, notes:'', days:[2,5], time:'09:00', price:7200, paid:'15.05.2026', freezeUsed:0, freezeMax:3, status:'active', lessons:[
      {date:'15.05',status:'done',note:''},{date:'19.05',status:'done',note:''},{date:'22.05',status:'done',note:''},
      {date:'26.05',status:'future',note:''},{date:'29.05',status:'future',note:''},{date:'02.06',status:'future',note:''}
    ], events:[
      {type:'payment',date:'15.05.2026',note:'Оплата · 6 занятий — 7 200 ₽ · Наличные'}
    ] },
  ];
})();

const DEMO_GROUPS = [
  { id:'g1', name:'Утренние совята',  age:'5–6 лет', color:'#3E5F4B', schedule:['Пн 09:00','Ср 09:00','Пт 09:00'], room:'Кабинет А', focus:'Чтение + развитие речи',  tag:'утро',  days:[1,3,5], time:'09:00', capacity:8 },
  { id:'g2', name:'Дневные лисята',   age:'6–7 лет', color:'#9B6B2F', schedule:['Вт 14:00','Чт 14:00'],            room:'Кабинет Б', focus:'Подготовка к 1 классу',  tag:'день',  days:[2,4],   time:'14:00', capacity:8 },
  { id:'g3', name:'Букварята',        age:'5–7 лет', color:'#2C5F77', schedule:['Пн 16:00','Ср 16:00'],            room:'Кабинет А', focus:'Чтение по слогам',       tag:'буква', days:[1,3],   time:'16:00', capacity:6 },
  { id:'g4', name:'Считалочки',       age:'6 лет',   color:'#8C4A4A', schedule:['Сб 11:00'],                       room:'Кабинет Б', focus:'Счёт до 100, задачи',    tag:'число', days:[6],     time:'11:00', capacity:6 },
  { id:'g5', name:'Индивидуальные',   age:'5–7 лет', color:'#5A4B7C', schedule:['по записи'],                      room:'—',         focus:'Персональная программа', tag:'1:1',   days:[],      time:'',      capacity:4 },
  { id:'g6', name:'Английский мини',  age:'6–7 лет', color:'#6B6024', schedule:['Чт 17:00'],                       room:'Кабинет А', focus:'Базовая лексика, песенки',tag:'eng',  days:[4],     time:'17:00', capacity:6 },
];

// ── Unified Store ──
const FIREBASE_RUNTIME = getFirebaseRuntimeConfig();
window.MK_FIREBASE_AUTH = FIREBASE_RUNTIME.enabled
  ? createFirebaseAuthController({
      firebaseConfig: FIREBASE_RUNTIME.firebase,
      allowedEmails: FIREBASE_RUNTIME.allowedEmails,
    })
  : null;
const syncStatusSubscribers = new Set();
window.MK_REPOSITORY_STATUS = { state: 'initializing' };
window.MK_SYNC_STATUS = {
  get value() {
    return window.MK_REPOSITORY_STATUS;
  },
  update(status) {
    window.MK_REPOSITORY_STATUS = status;
    syncStatusSubscribers.forEach((subscriber) => subscriber(status));
  },
  subscribe(subscriber) {
    syncStatusSubscribers.add(subscriber);
    return () => syncStatusSubscribers.delete(subscriber);
  },
};
window.MK_DOCUMENT_REPOSITORY = createDataRepository({
  storage: window.localStorage,
  key: MK_LS_KEY,
  waitForAccess: window.MK_FIREBASE_AUTH
    ? () => window.MK_FIREBASE_AUTH.waitForAuthorizedUser()
    : undefined,
  onStatus: (status) => {
    window.MK_SYNC_STATUS.update(status);
    document.documentElement.dataset.repositoryStatus = status.state;
    if (status.missing?.length) {
      document.documentElement.dataset.repositoryMissing =
        status.missing.join(',');
    } else {
      delete document.documentElement.dataset.repositoryMissing;
    }
  },
});

let parentCardsRefreshTimer = null;
const buildPublicCardForStudent = (student) => {
  const card = selectParentCardData({
    store: window.MK_STORAGE_MIGRATION?.store,
    legacyStudent: student,
    legacyGroups: window.MK_STORE.groups,
    legacyEvents: student.events || [],
  });
  return createPublicParentCard({
    student,
    groupName: card.groupName,
    subscription: card.subscription,
    remaining: card.remaining,
    events: card.events.slice(0, 4),
    teacherProfile: window.MK_PROFILE.data,
  });
};

const refreshPublishedParentCards = () => {
  if (!FIREBASE_RUNTIME.enabled || !window.MK_STORE) return;
  clearTimeout(parentCardsRefreshTimer);
  parentCardsRefreshTimer = setTimeout(async () => {
    const published = window.MK_STORE.students.filter(
      (student) => student.parentAccessToken,
    );
    if (!published.length) return;
    try {
      await window.MK_FIREBASE_AUTH.waitForAuthorizedUser();
      await Promise.all(
        published.map((student) =>
          publishPublicParentCard({
            firebaseConfig: FIREBASE_RUNTIME.firebase,
            token: student.parentAccessToken,
            card: buildPublicCardForStudent(student),
            waitForAccess: () => Promise.resolve(),
          }),
        ),
      );
    } catch (error) {
      console.error('[Parent cards sync]', error);
    }
  }, 700);
};

window.MK_STORE = createAppStore({
  repository: window.MK_DOCUMENT_REPOSITORY,
  seed: FIREBASE_RUNTIME.enabled
    ? { students: [], groups: [] }
    : { students: DEMO_STUDENTS, groups: DEMO_GROUPS },
  legacyScheduleOverrides: readLegacyScheduleOverrides(),
  legacyTeacherProfile: readLegacyTeacherProfile(),
  onCommit: () => {
    if (typeof window.MK_SYNC_V2 === 'function') window.MK_SYNC_V2();
    refreshPublishedParentCards();
  },
  onExternalChange: () => {
    if (typeof window.MK_SYNC_V2 === 'function') window.MK_SYNC_V2();
    refreshPublishedParentCards();
  },
});

window.MK_SYNC_V2 = () => {
  const migrationStorage = window.MK_DOCUMENT_REPOSITORY.storage;
  window.MK_STORAGE_MIGRATION = {
    ...ensureV2Migration({ storage: migrationStorage }),
    readLegacyBackup: () => readLegacyBackup(migrationStorage),
  };
  document.documentElement.dataset.storageMigration =
    window.MK_STORAGE_MIGRATION.status;
  document.documentElement.dataset.dataRepository =
    window.MK_DOCUMENT_REPOSITORY.kind;
  document.documentElement.dataset.scheduleOverrideDates = String(
    Object.keys(window.MK_STORE.scheduleOverrides).length,
  );
  if (window.MK_STORAGE_MIGRATION.schemaVersion) {
    document.documentElement.dataset.storageSchema = String(
      window.MK_STORAGE_MIGRATION.schemaVersion,
    );
  }
  return window.MK_STORAGE_MIGRATION;
};
window.MK_SYNC_V2();

// Keep MK_DATA for schedule week data only
window.MK_DATA = {
  subjects: ['Чтение','Математика','Письмо','Логика','Окружающий мир','Английский','Развитие речи'],
  get students() { return window.MK_STORE.students; },
  get groups() { return window.MK_STORE.groups; },
  attendance: FIREBASE_RUNTIME.enabled ? {} : {
    's1':  ['P','P','-','P','A','P','P','-','P','P','L','P','-','P'],
    's2':  ['P','L','P','P','-','P','P','P','-','A','P','P','P','-'],
    's3':  ['-','P','P','A','P','P','-','P','P','P','-','P','P','P'],
    's4':  ['P','P','P','-','P','P','P','A','-','P','P','P','-','P'],
    's5':  ['A','P','P','P','-','L','P','P','P','-','P','P','P','P'],
    's6':  ['P','P','-','P','P','P','A','-','P','P','P','L','P','-'],
    's7':  ['P','-','P','P','P','P','-','P','P','A','P','-','P','P'],
    's8':  ['-','P','L','P','P','-','P','P','P','P','-','A','P','P'],
    's9':  ['P','P','P','-','P','A','P','P','-','P','P','P','P','-'],
    's10': ['P','A','-','P','P','P','P','-','P','L','P','P','-','P'],
    's11': ['L','P','P','P','-','P','P','P','A','-','P','P','P','P'],
    's12': ['P','P','P','A','-','P','-','P','P','P','P','-','L','P'],
  },
  // Шаблон еженедельного расписания. ID нужны чтобы отменять/менять конкретные экземпляры через MK_SCHEDULE.overrides
  week: FIREBASE_RUNTIME.enabled ? [] : [
    {id:'t01',day:0,start:9,end:10,studentId:'s1',subject:'Чтение',tone:'green'},
    {id:'t02',day:0,start:10,end:11,studentId:'s2',subject:'Логика',tone:'ochre'},
    {id:'t03',day:0,start:11.5,end:12.5,studentId:'s5',subject:'Письмо',tone:'sky'},
    {id:'t04',day:0,start:16,end:17,groupId:'g3',subject:'Чтение по слогам',tone:'green',group:true},
    {id:'t05',day:0,start:18,end:19,studentId:'s11',subject:'Развитие речи',tone:'violet'},
    {id:'t06',day:1,start:10,end:11,studentId:'s6',subject:'Математика',tone:'ochre'},
    {id:'t07',day:1,start:14,end:15.5,groupId:'g2',subject:'Подготовка',tone:'green',group:true},
    {id:'t08',day:1,start:16,end:17,studentId:'s3',subject:'Окруж. мир',tone:'sky'},
    {id:'t09',day:1,start:17.5,end:18.5,studentId:'s9',subject:'Чтение',tone:'green'},
    {id:'t10',day:2,start:9,end:10,studentId:'s11',subject:'Письмо',tone:'sky'},
    {id:'t11',day:2,start:10,end:11,studentId:'s7',subject:'Английский',tone:'violet'},
    {id:'t12',day:2,start:11.5,end:12.5,studentId:'s12',subject:'Логика',tone:'ochre'},
    {id:'t13',day:2,start:16,end:17,groupId:'g3',subject:'Чтение по слогам',tone:'green',group:true},
    {id:'t14',day:2,start:18,end:19,studentId:'s8',subject:'Математика',tone:'ochre'},
    {id:'t15',day:3,start:9.5,end:10.5,studentId:'s10',subject:'Математика',tone:'ochre'},
    {id:'t16',day:3,start:11,end:12,studentId:'s4',subject:'Письмо',tone:'sky'},
    {id:'t17',day:3,start:14,end:15.5,groupId:'g2',subject:'Чтение',tone:'green',group:true},
    {id:'t18',day:3,start:17,end:18,groupId:'g6',subject:'Английский',tone:'violet',group:true},
    {id:'t19',day:4,start:9,end:10,studentId:'s1',subject:'Чтение',tone:'green'},
    {id:'t20',day:4,start:10.5,end:11.5,studentId:'s5',subject:'Логика',tone:'ochre'},
    {id:'t21',day:4,start:12,end:13,studentId:'s2',subject:'Окруж. мир',tone:'sky'},
    {id:'t22',day:4,start:15,end:16,studentId:'s6',subject:'Математика',tone:'ochre'},
    {id:'t23',day:4,start:17,end:18,studentId:'s12',subject:'Чтение',tone:'green'},
    {id:'t24',day:5,start:11,end:12.5,groupId:'g4',subject:'Считалочки',tone:'berry',group:true},
    {id:'t25',day:5,start:13,end:14,studentId:'s8',subject:'Письмо',tone:'sky'},
  ],
  get today() {
    const now = new Date();
    const wds = ['ВС','ПН','ВТ','СР','ЧТ','ПТ','СБ'];
    const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
    const weekdays = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
    const todayWd = now.getDay();
    const todayDate = now.getDate();
    // Build week strip starting from Mon
    const weekNums = [];
    const week = ['ПН','ВТ','СР','ЧТ','ПТ','СБ','ВС'];
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay()+6)%7));
    for (let i=0;i<7;i++) { const d=new Date(monday); d.setDate(monday.getDate()+i); weekNums.push(String(d.getDate())); }
    const todayIdx = (todayWd+6)%7;
    const active = window.MK_STORE.students.filter(s=>s.status==='active').length;
    return {
      weekday: weekdays[todayWd],
      date: String(todayDate),
      month: months[now.getMonth()],
      year: String(now.getFullYear()),
      summary: { lessons: active, students: active, hours: Math.round(active*0.9*10)/10 },
      week, weekNums, todayIdx,
    };
  },
  alerts: [],
};

// ── Алерты учителя — автогенерация из реальных данных + хранение "прочитано" ──
const MK_ALERTS_READ_KEY = 'mk.alerts.read';
window.MK_ALERTS = (() => {
  const _load = () => { try { return new Set(JSON.parse(localStorage.getItem(MK_ALERTS_READ_KEY) || '[]')); } catch { return new Set(); } };
  const _save = (s) => { try { localStorage.setItem(MK_ALERTS_READ_KEY, JSON.stringify([...s])); } catch {} };
  const _subs = new Set();
  let _read = _load();

  const _compute = () => {
    const out = [];
    const students = (window.MK_STORE && window.MK_STORE.students) || [];
    const now = new Date();

    // 1) Ожидающие оплаты
    for (const s of students) {
      for (const e of (s.events || [])) {
        if (e.type !== 'payment-pending') continue;
        out.push({
          id: `pay-pending:${s.id}:${e.date}`,
          when: e.date,
          kind: 'warn',
          body: `<b>${s.name}</b> — ждём оплату: ${e.note}`,
          target: { type: 'student', id: s.id },
          cta: 'Открыть карточку',
        });
      }
    }

    // 2) Пакет на исходе / закончился
    for (const s of students) {
      const left = (s.pack || 0) - (s.used || 0);
      if (left === 1) {
        out.push({
          id: `low:${s.id}`,
          when: 'сейчас',
          kind: 'warn',
          body: `У <b>${s.name}</b> остался <b>1 урок</b> из ${s.pack}`,
          target: { type: 'student', id: s.id },
          cta: 'Продлить пакет',
          action: 'renew',
        });
      } else if (left <= 0 && s.status !== 'ended') {
        out.push({
          id: `empty:${s.id}`,
          when: 'сейчас',
          kind: 'berry',
          body: `<b>${s.name}</b> — <b>пакет израсходован</b>`,
          target: { type: 'student', id: s.id },
          cta: 'Продлить пакет',
          action: 'renew',
        });
      }
    }

    // 3) Недавние оплаты (7 дней)
    for (const s of students) {
      for (const e of (s.events || [])) {
        if (e.type !== 'payment') continue;
        const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(e.date || '');
        if (!m) continue;
        const eDate = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
        const daysAgo = Math.round((now - eDate) / (24 * 3600 * 1000));
        if (daysAgo < 0 || daysAgo > 7) continue;
        const rub = (e.note || '').match(/([\d\s ]+)\s*₽/);
        const amt = rub ? rub[1].trim().replace(/\s+/g, ' ') : '';
        out.push({
          id: `paid:${s.id}:${e.date}`,
          when: e.date.slice(0, 5),
          kind: 'good',
          body: `<b>${s.name}</b> оплатила пакет${amt ? ' — ' + amt + ' ₽' : ''}`,
          target: { type: 'student', id: s.id },
          cta: 'Открыть карточку',
        });
      }
    }

    // 4) Дни рождения (в ближайшие 7 дней)
    for (const s of students) {
      if (!s.birthDate) continue;
      const bm = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s.birthDate);
      if (!bm) continue;
      const [, bd, bmonth] = bm;
      const thisYear = now.getFullYear();
      let nextBday = new Date(thisYear, parseInt(bmonth) - 1, parseInt(bd));
      if (nextBday < new Date(now.getFullYear(), now.getMonth(), now.getDate())) nextBday = new Date(thisYear + 1, parseInt(bmonth) - 1, parseInt(bd));
      const daysUntil = Math.round((nextBday - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / (24 * 3600 * 1000));
      if (daysUntil > 7) continue;
      const whenLabel = daysUntil === 0 ? 'сегодня' : daysUntil === 1 ? 'завтра' : `через ${daysUntil} дн.`;
      out.push({
        id: `bday:${s.id}:${bmonth}${bd}`,
        when: daysUntil === 0 ? 'сегодня!' : `через ${daysUntil} дн.`,
        kind: daysUntil === 0 ? 'good' : 'info',
        body: `🎂 День рождения — <b>${s.name}</b> (${whenLabel})`,
        target: { type: 'student', id: s.id },
        cta: 'Открыть карточку',
      });
    }

    // Сортировка: непрочитанные сверху
    return out;
  };

  return {
    get items() { return _compute().map(a => ({ ...a, read: _read.has(a.id) })); },
    get unreadCount() { return _compute().filter(a => !_read.has(a.id)).length; },
    markRead(id) { _read.add(id); _save(_read); _subs.forEach(cb => { try { cb(); } catch (e) { console.error(e); } }); },
    markAllRead() { for (const a of _compute()) _read.add(a.id); _save(_read); _subs.forEach(cb => { try { cb(); } catch (e) { console.error(e); } }); },
    subscribe(cb) { _subs.add(cb); return () => _subs.delete(cb); },
  };
})();

// ── Наблюдения недели — авто-генерация для Dashboard ──
window.MK_OBSERVATIONS = (() => {
  const compute = () => {
    const out = [];
    const students = (window.MK_STORE && window.MK_STORE.students) || [];
    for (const s of students) {
      const lessons = s.lessons || [];
      const short = s.short || s.name.split(' ')[0];
      // Положительный — много 'done' подряд
      const recent = lessons.slice(-6);
      const recentDone = recent.filter(l => l.status === 'done').length;
      if (recentDone >= 4) {
        out.push({
          kind: 'up', name: short, color: 'var(--forest)', icon: '↗',
          hint: `${recentDone} из ${recent.length} последних уроков проведены`,
          text: 'Стабильно ходит — поддерживаем темп.',
        });
      }
      // Болезнь / переносы
      const sickCount = lessons.filter(l => l.status === 'sick' || l.status === 'sick-wait').length;
      if (sickCount >= 2) {
        out.push({
          kind: 'warn', name: short, color: 'var(--ochre-deep)', icon: '⌛',
          hint: `${sickCount} переносов по болезни`,
          text: 'Уточнить у родителей о здоровье.',
        });
      }
      // Пакет на исходе
      const left = (s.pack || 0) - (s.used || 0);
      if (left === 1) {
        out.push({
          kind: 'urgent', name: short, color: 'var(--berry)', icon: '!',
          hint: `остался ${left} урок из ${s.pack}`,
          text: 'Напомнить о продлении абонемента.',
        });
      }
    }
    return out.slice(0, 3);
  };
  return { get items() { return compute(); } };
})();

// ── Профиль учителя — совместимый фасад над единым репозиторием ──
window.MK_PROFILE = {
  get data() {
    return window.MK_STORE.teacherProfile;
  },
  subscribe(callback) {
    return window.MK_STORE.subscribe(callback);
  },
  update(patch) {
    window.MK_STORE.updateTeacherProfile(patch);
  },
};

// ── Lesson statuses (used by per-student & by group bulk conduct UIs) ──
window.MK_LESSON_LABELS = {
  future: 'Запланировано', done: 'Проведено', transfer: 'Отработка',
  sick: 'Перенос', 'sick-wait': 'Жду справку', freeze: 'Заморожено', refund: 'Возврат',
  absent: 'Не пришёл', 'teacher-cancel': 'Перенос педагогом',
};
window.MK_LESSON_STATUSES = [
  { k:'done',           label:'✓ Проведено',              color:'var(--forest)' },
  { k:'future',         label:'○ Запланировано',          color:'var(--ink-faint)' },
  { k:'absent',         label:'🚫 Не пришёл',             color:'var(--ochre-deep)' },
  { k:'teacher-cancel', label:'🏫 Перенос педагогом',     color:'var(--ink-faint)' },
  { k:'transfer',       label:'↪ Отработка',              color:'var(--ochre-deep)' },
  { k:'sick-wait',      label:'🤒 Болезнь — жду справку', color:'var(--ochre-deep)' },
  { k:'sick',           label:'📋 Болезнь — перенос',     color:'var(--ochre-deep)' },
  { k:'freeze',         label:'❄ Заморожено',             color:'var(--sky)' },
  { k:'refund',         label:'↩ Возврат',                color:'var(--berry)' },
];

// ── Schedule overrides (per-date cancellations + extra lessons) ──
window.MK_SCHEDULE = (() => {
  const _subs = new Set();
  let _data = window.MK_STORE.scheduleOverrides;
  window.MK_STORE.subscribe(() => {
    const next = window.MK_STORE.scheduleOverrides;
    if (next === _data) return;
    _data = next;
    _subs.forEach(cb => { try { cb(); } catch (e) { console.error(e); } });
  });

  const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  // Цвет группы → tone-класс блока в Расписании
  const _toneForColor = (hex) => {
    const c = (hex || '').toLowerCase();
    if (c.includes('3e5f4b') || c.includes('1f3a2e') || c.includes('4a6b3e')) return 'green';
    if (c.includes('9b6b2f') || c.includes('6b6024') || c.includes('7c5a2e')) return 'ochre';
    if (c.includes('2c5f77') || c.includes('3d4f7a')) return 'sky';
    if (c.includes('8c4a4a') || c.includes('7a4a2e')) return 'berry';
    if (c.includes('5a4b7c') || c.includes('5e3d6b')) return 'violet';
    return 'green';
  };

  // Объединённый шаблон недели: статичный MK_DATA.week + автогенерация из MK_STORE.groups[].schedule
  const getEffectiveTemplate = () => {
    const staticT = window.MK_DATA.week || [];
    const dayMap = {'вс':0,'пн':1,'вт':2,'ср':3,'чт':4,'пт':5,'сб':6};
    const fromGroups = [];
    for (const g of (window.MK_STORE?.groups || [])) {
      for (const slot of (g.schedule || [])) {
        const m = String(slot).toLowerCase().match(/(вс|пн|вт|ср|чт|пт|сб)\s*(\d{1,2}):(\d{2})/);
        if (!m) continue;
        // День в формате 0-6 где 0=Пн (как в шаблоне), а dayMap 0=Вс. Переводим: dayMap дает 0-6 как JS getDay, нам нужен 0=Пн => (jsDay+6)%7
        const jsDay = dayMap[m[1]];
        const day = (jsDay + 6) % 7;
        const startH = +m[2] + +m[3]/60;
        // Дубликат? — пропускаем
        const dup = staticT.some(b => b.group && b.groupId === g.id && b.day === day && Math.abs(b.start - startH) < 0.05);
        if (dup) continue;
        // Также не дублируем уже сгенерированные слоты для этой группы
        const dupGen = fromGroups.some(b => b.groupId === g.id && b.day === day && Math.abs(b.start - startH) < 0.05);
        if (dupGen) continue;
        fromGroups.push({
          id: `gt_${g.id}_${day}_${m[2]}${m[3]}`,
          day, start: startH, end: startH + 1,
          groupId: g.id,
          subject: g.focus || g.name || 'Занятие',
          tone: _toneForColor(g.color),
          group: true,
        });
      }
    }
    // Фильтруем staticT:
    //  1) Скрываем индивидуальный слот, если ученик в группе с собранием в это же время (дубль)
    //  2) Скрываем индивидуальный слот, если у ученика закончился пакет (pack-used <= 0)
    //     или статус ended — нет смысла его планировать пока не продлили
    //  Групповые уроки не фильтруем — в группе могут быть другие активные ученики
    const allSlots = [...staticT, ...fromGroups];
    const filteredStatic = staticT.filter(b => {
      if (b.group || !b.studentId) return true;
      const student = (window.MK_STORE?.students || []).find(s => s.id === b.studentId);
      if (!student) return false;
      // (2) Закрытый абонемент — только ручное закрытие учителем
      if (student.status === 'ended') return false;
      // (1) Дубль с группой
      if (student.groupId) {
        const groupHasSlot = allSlots.some(gb =>
          gb.group && gb.groupId === student.groupId
            && gb.day === b.day && Math.abs(gb.start - b.start) < 0.05
        );
        if (groupHasSlot) return false;
      }
      return true;
    });
    // Слоты из доп. абонементов учеников
    const fromExtraSubs = [];
    for (const student of (window.MK_STORE?.students || [])) {
      if (student.status === 'ended') continue;
      for (const esub of (student.extraSubs || [])) {
        if (esub.status === 'ended') continue;
        if (esub.groupId) continue; // группа уже генерирует свой слот
        if (!esub.days || !esub.days.length || !esub.time) continue;
        const [hStr, mStr] = String(esub.time).split(':');
        const startH = +hStr + +mStr / 60;
        for (const jsDay of esub.days) {
          const day = (jsDay + 6) % 7;
          fromExtraSubs.push({
            id: `esub_${student.id}_${esub.id}_${day}`,
            day, start: startH, end: startH + 1,
            studentId: student.id,
            extraSubId: esub.id,
            subject: esub.subject || 'Занятие',
            tone: 'ochre',
          });
        }
      }
    }
    return [...filteredStatic, ...fromGroups, ...fromExtraSubs];
  };

  return {
    fmtDate,
    getEffectiveTemplate,
    get overrides() { return _data; },
    subscribe(cb) { _subs.add(cb); return () => _subs.delete(cb); },

    isCancelled(dateKey, lessonId) {
      return (_data[dateKey]?.cancelled || []).includes(lessonId);
    },

    toggleCancel(dateKey, lessonId) {
      const next = { ..._data };
      const day = { ...(next[dateKey] || {}) };
      const list = [...(day.cancelled || [])];
      const i = list.indexOf(lessonId);
      if (i >= 0) list.splice(i, 1); else list.push(lessonId);
      day.cancelled = list;
      if ((day.cancelled||[]).length === 0 && (day.extra||[]).length === 0) delete next[dateKey];
      else next[dateKey] = day;
      window.MK_STORE.setScheduleOverrides(next);
    },

    addExtra(dateKey, lesson) {
      const next = { ..._data };
      const day = { ...(next[dateKey] || {}) };
      const extra = [...(day.extra || []), { ...lesson, id: lesson.id || `e_${Date.now()}_${Math.random().toString(36).slice(2,6)}` }];
      day.extra = extra; next[dateKey] = day;
      window.MK_STORE.setScheduleOverrides(next);
    },

    removeExtra(dateKey, lessonId) {
      const next = { ..._data };
      const day = { ...(next[dateKey] || {}) };
      day.extra = (day.extra || []).filter(l => l.id !== lessonId);
      if ((day.cancelled||[]).length === 0 && day.extra.length === 0) delete next[dateKey];
      else next[dateKey] = day;
      window.MK_STORE.setScheduleOverrides(next);
    },

    // Эффективные уроки на конкретную дату: шаблон по дню недели + extras − cancelled
    lessonsForDate(date) {
      const day = (date.getDay() + 6) % 7;
      const key = fmtDate(date);
      const ovr = _data[key] || {};
      const cancelled = new Set(ovr.cancelled || []);
      const fromTemplate = getEffectiveTemplate()
        .filter(t => t.day === day)
        .map(t => ({ ...t, date: key, canceled: cancelled.has(t.id) }));
      const extras = (ovr.extra || []).map(l => ({ ...l, date: key, day }));
      const fromIndividual = (window.MK_STORE?.students || []).flatMap(st =>
        (st.individualLessons || [])
          .filter(il => il.date === key)
          .map(il => {
            const [hStr, mStr] = String(il.time || '15:00').split(':');
            const start = +hStr + +mStr / 60;
            return { id: il.id, start, end: start + 1, studentId: st.id, individualLessonId: il.id, subject: il.subject || 'Разовый урок', tone: 'berry', date: key, day, individual: true };
          })
      );
      return [...fromTemplate, ...extras, ...fromIndividual].sort((a, b) => a.start - b.start);
    },
  };
})();

// ---- Legacy section 2 ----
// tweaks-panel.jsx
// Reusable Tweaks shell + form-control helpers.
//
// Owns the host protocol (listens for __activate_edit_mode / __deactivate_edit_mode,
// posts __edit_mode_available / __edit_mode_set_keys / __edit_mode_dismissed) so
// individual prototypes don't re-roll it. Ships a consistent set of controls so you
// don't hand-draw <input type="range">, segmented radios, steppers, etc.
//
// Usage (in an HTML file that loads React + Babel):
//
//   const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
//     "primaryColor": "#D97757",
//     "palette": ["#D97757", "#29261b", "#f6f4ef"],
//     "fontSize": 16,
//     "density": "regular",
//     "dark": false
//   }/*EDITMODE-END*/;
//
//   function App() {
//     const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
//     return (
//       <div style={{ fontSize: t.fontSize, color: t.primaryColor }}>
//         Hello
//         <TweaksPanel>
//           <TweakSection label="Typography" />
//           <TweakSlider label="Font size" value={t.fontSize} min={10} max={32} unit="px"
//                        onChange={(v) => setTweak('fontSize', v)} />
//           <TweakRadio  label="Density" value={t.density}
//                        options={['compact', 'regular', 'comfy']}
//                        onChange={(v) => setTweak('density', v)} />
//           <TweakSection label="Theme" />
//           <TweakColor  label="Primary" value={t.primaryColor}
//                        options={['#D97757', '#2A6FDB', '#1F8A5B', '#7A5AE0']}
//                        onChange={(v) => setTweak('primaryColor', v)} />
//           <TweakColor  label="Palette" value={t.palette}
//                        options={[['#D97757', '#29261b', '#f6f4ef'],
//                                  ['#475569', '#0f172a', '#f1f5f9']]}
//                        onChange={(v) => setTweak('palette', v)} />
//           <TweakToggle label="Dark mode" value={t.dark}
//                        onChange={(v) => setTweak('dark', v)} />
//         </TweaksPanel>
//       </div>
//     );
//   }
//
// ─────────────────────────────────────────────────────────────────────────────

const __TWEAKS_STYLE = `
  .twk-panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:280px;
    max-height:calc(100vh - 32px);display:flex;flex-direction:column;
    transform:scale(var(--dc-inv-zoom,1));transform-origin:bottom right;
    background:rgba(250,249,247,.78);color:#29261b;
    -webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
    border:.5px solid rgba(255,255,255,.6);border-radius:14px;
    box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 12px 40px rgba(0,0,0,.18);
    font:11.5px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;overflow:hidden}
  .twk-hd{display:flex;align-items:center;justify-content:space-between;
    padding:10px 8px 10px 14px;cursor:move;user-select:none}
  .twk-hd b{font-size:12px;font-weight:600;letter-spacing:.01em}
  .twk-x{appearance:none;border:0;background:transparent;color:rgba(41,38,27,.55);
    width:22px;height:22px;border-radius:6px;cursor:default;font-size:13px;line-height:1}
  .twk-x:hover{background:rgba(0,0,0,.06);color:#29261b}
  .twk-body{padding:2px 14px 14px;display:flex;flex-direction:column;gap:10px;
    overflow-y:auto;overflow-x:hidden;min-height:0;
    scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.15) transparent}
  .twk-body::-webkit-scrollbar{width:8px}
  .twk-body::-webkit-scrollbar-track{background:transparent;margin:2px}
  .twk-body::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:4px;
    border:2px solid transparent;background-clip:content-box}
  .twk-body::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.25);
    border:2px solid transparent;background-clip:content-box}
  .twk-row{display:flex;flex-direction:column;gap:5px}
  .twk-row-h{flex-direction:row;align-items:center;justify-content:space-between;gap:10px}
  .twk-lbl{display:flex;justify-content:space-between;align-items:baseline;
    color:rgba(41,38,27,.72)}
  .twk-lbl>span:first-child{font-weight:500}
  .twk-val{color:rgba(41,38,27,.5);font-variant-numeric:tabular-nums}

  .twk-sect{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
    color:rgba(41,38,27,.45);padding:10px 0 0}
  .twk-sect:first-child{padding-top:0}

  .twk-field{appearance:none;box-sizing:border-box;width:100%;min-width:0;height:26px;padding:0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;
    background:rgba(255,255,255,.6);color:inherit;font:inherit;outline:none}
  .twk-field:focus{border-color:rgba(0,0,0,.25);background:rgba(255,255,255,.85)}
  select.twk-field{padding-right:22px;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='rgba(0,0,0,.5)' d='M0 0h10L5 6z'/></svg>");
    background-repeat:no-repeat;background-position:right 8px center}

  .twk-slider{appearance:none;-webkit-appearance:none;width:100%;height:4px;margin:6px 0;
    border-radius:999px;background:rgba(0,0,0,.12);outline:none}
  .twk-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
    width:14px;height:14px;border-radius:50%;background:#fff;
    border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}
  .twk-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;
    background:#fff;border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}

  .twk-seg{position:relative;display:flex;padding:2px;border-radius:8px;
    background:rgba(0,0,0,.06);user-select:none}
  .twk-seg-thumb{position:absolute;top:2px;bottom:2px;border-radius:6px;
    background:rgba(255,255,255,.9);box-shadow:0 1px 2px rgba(0,0,0,.12);
    transition:left .15s cubic-bezier(.3,.7,.4,1),width .15s}
  .twk-seg.dragging .twk-seg-thumb{transition:none}
  .twk-seg button{appearance:none;position:relative;z-index:1;flex:1;border:0;
    background:transparent;color:inherit;font:inherit;font-weight:500;min-height:22px;
    border-radius:6px;cursor:default;padding:4px 6px;line-height:1.2;
    overflow-wrap:anywhere}

  .twk-toggle{position:relative;width:32px;height:18px;border:0;border-radius:999px;
    background:rgba(0,0,0,.15);transition:background .15s;cursor:default;padding:0}
  .twk-toggle[data-on="1"]{background:#34c759}
  .twk-toggle i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;
    background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
  .twk-toggle[data-on="1"] i{transform:translateX(14px)}

  .twk-num{display:flex;align-items:center;box-sizing:border-box;min-width:0;height:26px;padding:0 0 0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;background:rgba(255,255,255,.6)}
  .twk-num-lbl{font-weight:500;color:rgba(41,38,27,.6);cursor:ew-resize;
    user-select:none;padding-right:8px}
  .twk-num input{flex:1;min-width:0;height:100%;border:0;background:transparent;
    font:inherit;font-variant-numeric:tabular-nums;text-align:right;padding:0 8px 0 0;
    outline:none;color:inherit;-moz-appearance:textfield}
  .twk-num input::-webkit-inner-spin-button,.twk-num input::-webkit-outer-spin-button{
    -webkit-appearance:none;margin:0}
  .twk-num-unit{padding-right:8px;color:rgba(41,38,27,.45)}

  .twk-btn{appearance:none;height:26px;padding:0 12px;border:0;border-radius:7px;
    background:rgba(0,0,0,.78);color:#fff;font:inherit;font-weight:500;cursor:default}
  .twk-btn:hover{background:rgba(0,0,0,.88)}
  .twk-btn.secondary{background:rgba(0,0,0,.06);color:inherit}
  .twk-btn.secondary:hover{background:rgba(0,0,0,.1)}

  .twk-swatch{appearance:none;-webkit-appearance:none;width:56px;height:22px;
    border:.5px solid rgba(0,0,0,.1);border-radius:6px;padding:0;cursor:default;
    background:transparent;flex-shrink:0}
  .twk-swatch::-webkit-color-swatch-wrapper{padding:0}
  .twk-swatch::-webkit-color-swatch{border:0;border-radius:5.5px}
  .twk-swatch::-moz-color-swatch{border:0;border-radius:5.5px}

  .twk-chips{display:flex;gap:6px}
  .twk-chip{position:relative;appearance:none;flex:1;min-width:0;height:46px;
    padding:0;border:0;border-radius:6px;overflow:hidden;cursor:default;
    box-shadow:0 0 0 .5px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.06);
    transition:transform .12s cubic-bezier(.3,.7,.4,1),box-shadow .12s}
  .twk-chip:hover{transform:translateY(-1px);
    box-shadow:0 0 0 .5px rgba(0,0,0,.18),0 4px 10px rgba(0,0,0,.12)}
  .twk-chip[data-on="1"]{box-shadow:0 0 0 1.5px rgba(0,0,0,.85),
    0 2px 6px rgba(0,0,0,.15)}
  .twk-chip>span{position:absolute;top:0;bottom:0;right:0;width:34%;
    display:flex;flex-direction:column;box-shadow:-1px 0 0 rgba(0,0,0,.1)}
  .twk-chip>span>i{flex:1;box-shadow:0 -1px 0 rgba(0,0,0,.1)}
  .twk-chip>span>i:first-child{box-shadow:none}
  .twk-chip svg{position:absolute;top:6px;left:6px;width:13px;height:13px;
    filter:drop-shadow(0 1px 1px rgba(0,0,0,.3))}
`;

// ── useTweaks ───────────────────────────────────────────────────────────────
// Single source of truth for tweak values. setTweak persists via the host
// (__edit_mode_set_keys → host rewrites the EDITMODE block on disk).
function useTweaks(defaults) {
  const [values, setValues] = React.useState(defaults);
  // Accepts either setTweak('key', value) or setTweak({ key: value, ... }) so a
  // useState-style call doesn't write a "[object Object]" key into the persisted
  // JSON block.
  const setTweak = React.useCallback((keyOrEdits, val) => {
    const edits = typeof keyOrEdits === 'object' && keyOrEdits !== null
      ? keyOrEdits : { [keyOrEdits]: val };
    setValues((prev) => ({ ...prev, ...edits }));
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits }, '*');
    // Same-window signal so in-page listeners (deck-stage rail thumbnails)
    // can react — the parent message only reaches the host, not peers.
    window.dispatchEvent(new CustomEvent('tweakchange', { detail: edits }));
  }, []);
  return [values, setTweak];
}

// ── TweaksPanel ─────────────────────────────────────────────────────────────
// Floating shell. Registers the protocol listener BEFORE announcing
// availability — if the announce ran first, the host's activate could land
// before our handler exists and the toolbar toggle would silently no-op.
// The close button posts __edit_mode_dismissed so the host's toolbar toggle
// flips off in lockstep; the host echoes __deactivate_edit_mode back which
// is what actually hides the panel.
function TweaksPanel({ title = 'Tweaks', noDeckControls = false, children }) {
  const [open, setOpen] = React.useState(false);
  const dragRef = React.useRef(null);
  // Auto-inject a rail toggle when a <deck-stage> is on the page. The
  // toggle drives the deck's per-viewer _railVisible via window message;
  // state is mirrored from the same localStorage key the deck reads so
  // the control reflects reality across reloads. The mechanism is the
  // message — authors who want custom placement can post it directly
  // and pass noDeckControls to suppress this one.
  const hasDeckStage = React.useMemo(
    () => typeof document !== 'undefined' && !!document.querySelector('deck-stage'),
    [],
  );
  // deck-stage enables its rail in connectedCallback, but this panel can
  // mount before that element has upgraded. The initial read catches the
  // common case; the listener covers mounting first. (Older deck-stage.js
  // copies still wait for the host's __omelette_rail_enabled postMessage —
  // same listener handles those.)
  const [railEnabled, setRailEnabled] = React.useState(
    () => hasDeckStage && !!document.querySelector('deck-stage')?._railEnabled,
  );
  React.useEffect(() => {
    if (!hasDeckStage || railEnabled) return undefined;
    const onMsg = (e) => {
      if (e.data && e.data.type === '__omelette_rail_enabled') setRailEnabled(true);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [hasDeckStage, railEnabled]);
  const [railVisible, setRailVisible] = React.useState(() => {
    try { return localStorage.getItem('deck-stage.railVisible') !== '0'; } catch (e) { return true; }
  });
  const toggleRail = (on) => {
    setRailVisible(on);
    window.postMessage({ type: '__deck_rail_visible', on }, '*');
  };
  const offsetRef = React.useRef({ x: 16, y: 16 });
  const PAD = 16;

  const clampToViewport = React.useCallback(() => {
    const panel = dragRef.current;
    if (!panel) return;
    const w = panel.offsetWidth, h = panel.offsetHeight;
    const maxRight = Math.max(PAD, window.innerWidth - w - PAD);
    const maxBottom = Math.max(PAD, window.innerHeight - h - PAD);
    offsetRef.current = {
      x: Math.min(maxRight, Math.max(PAD, offsetRef.current.x)),
      y: Math.min(maxBottom, Math.max(PAD, offsetRef.current.y)),
    };
    panel.style.right = offsetRef.current.x + 'px';
    panel.style.bottom = offsetRef.current.y + 'px';
  }, []);

  React.useEffect(() => {
    if (!open) return;
    clampToViewport();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', clampToViewport);
      return () => window.removeEventListener('resize', clampToViewport);
    }
    const ro = new ResizeObserver(clampToViewport);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [open, clampToViewport]);

  React.useEffect(() => {
    const onMsg = (e) => {
      const t = e?.data?.type;
      if (t === '__activate_edit_mode') setOpen(true);
      else if (t === '__deactivate_edit_mode') setOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const dismiss = () => {
    setOpen(false);
    window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*');
  };

  const onDragStart = (e) => {
    const panel = dragRef.current;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY;
    const startRight = window.innerWidth - r.right;
    const startBottom = window.innerHeight - r.bottom;
    const move = (ev) => {
      offsetRef.current = {
        x: startRight - (ev.clientX - sx),
        y: startBottom - (ev.clientY - sy),
      };
      clampToViewport();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  if (!open) return null;
  return (
    <>
      <style>{__TWEAKS_STYLE}</style>
      <div ref={dragRef} className="twk-panel" data-noncommentable=""
           style={{ right: offsetRef.current.x, bottom: offsetRef.current.y }}>
        <div className="twk-hd" onMouseDown={onDragStart}>
          <b>{title}</b>
          <button className="twk-x" aria-label="Close tweaks"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={dismiss}>✕</button>
        </div>
        <div className="twk-body">
          {children}
          {hasDeckStage && railEnabled && !noDeckControls && (
            <TweakSection label="Deck">
              <TweakToggle label="Thumbnail rail" value={railVisible} onChange={toggleRail} />
            </TweakSection>
          )}
        </div>
      </div>
    </>
  );
}

// ── Layout helpers ──────────────────────────────────────────────────────────

function TweakSection({ label, children }) {
  return (
    <>
      <div className="twk-sect">{label}</div>
      {children}
    </>
  );
}

function TweakRow({ label, value, children, inline = false }) {
  return (
    <div className={inline ? 'twk-row twk-row-h' : 'twk-row'}>
      <div className="twk-lbl">
        <span>{label}</span>
        {value != null && <span className="twk-val">{value}</span>}
      </div>
      {children}
    </div>
  );
}

// ── Controls ────────────────────────────────────────────────────────────────

function TweakSlider({ label, value, min = 0, max = 100, step = 1, unit = '', onChange }) {
  return (
    <TweakRow label={label} value={`${value}${unit}`}>
      <input type="range" className="twk-slider" min={min} max={max} step={step}
             value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </TweakRow>
  );
}

function TweakToggle({ label, value, onChange }) {
  return (
    <div className="twk-row twk-row-h">
      <div className="twk-lbl"><span>{label}</span></div>
      <button type="button" className="twk-toggle" data-on={value ? '1' : '0'}
              role="switch" aria-checked={!!value}
              onClick={() => onChange(!value)}><i /></button>
    </div>
  );
}

function TweakRadio({ label, value, options, onChange }) {
  const trackRef = React.useRef(null);
  const [dragging, setDragging] = React.useState(false);
  // The active value is read by pointer-move handlers attached for the lifetime
  // of a drag — ref it so a stale closure doesn't fire onChange for every move.
  const valueRef = React.useRef(value);
  valueRef.current = value;

  // Segments wrap mid-word once per-segment width runs out. The track is
  // ~248px (280 panel − 28 body pad − 4 seg pad), each button loses 12px
  // to its own padding, and 11.5px system-ui averages ~6.3px/char — so 2
  // options fit ~16 chars each, 3 fit ~10. Past that (or >3 options), fall
  // back to a dropdown rather than wrap.
  const labelLen = (o) => String(typeof o === 'object' ? o.label : o).length;
  const maxLen = options.reduce((m, o) => Math.max(m, labelLen(o)), 0);
  const fitsAsSegments = maxLen <= ({ 2: 16, 3: 10 }[options.length] ?? 0);
  if (!fitsAsSegments) {
    // <select> emits strings — map back to the original option value so the
    // fallback stays type-preserving (numbers, booleans) like the segment path.
    const resolve = (s) => {
      const m = options.find((o) => String(typeof o === 'object' ? o.value : o) === s);
      return m === undefined ? s : typeof m === 'object' ? m.value : m;
    };
    return <TweakSelect label={label} value={value} options={options}
                        onChange={(s) => onChange(resolve(s))} />;
  }
  const opts = options.map((o) => (typeof o === 'object' ? o : { value: o, label: o }));
  const idx = Math.max(0, opts.findIndex((o) => o.value === value));
  const n = opts.length;

  const segAt = (clientX) => {
    const r = trackRef.current.getBoundingClientRect();
    const inner = r.width - 4;
    const i = Math.floor(((clientX - r.left - 2) / inner) * n);
    return opts[Math.max(0, Math.min(n - 1, i))].value;
  };

  const onPointerDown = (e) => {
    setDragging(true);
    const v0 = segAt(e.clientX);
    if (v0 !== valueRef.current) onChange(v0);
    const move = (ev) => {
      if (!trackRef.current) return;
      const v = segAt(ev.clientX);
      if (v !== valueRef.current) onChange(v);
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <TweakRow label={label}>
      <div ref={trackRef} role="radiogroup" onPointerDown={onPointerDown}
           className={dragging ? 'twk-seg dragging' : 'twk-seg'}>
        <div className="twk-seg-thumb"
             style={{ left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
                      width: `calc((100% - 4px) / ${n})` }} />
        {opts.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={o.value === value}>
            {o.label}
          </button>
        ))}
      </div>
    </TweakRow>
  );
}

function TweakSelect({ label, value, options, onChange }) {
  return (
    <TweakRow label={label}>
      <select className="twk-field" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => {
          const v = typeof o === 'object' ? o.value : o;
          const l = typeof o === 'object' ? o.label : o;
          return <option key={v} value={v}>{l}</option>;
        })}
      </select>
    </TweakRow>
  );
}

function TweakText({ label, value, placeholder, onChange }) {
  return (
    <TweakRow label={label}>
      <input className="twk-field" type="text" value={value} placeholder={placeholder}
             onChange={(e) => onChange(e.target.value)} />
    </TweakRow>
  );
}

function TweakNumber({ label, value, min, max, step = 1, unit = '', onChange }) {
  const clamp = (n) => {
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
  };
  const startRef = React.useRef({ x: 0, val: 0 });
  const onScrubStart = (e) => {
    e.preventDefault();
    startRef.current = { x: e.clientX, val: value };
    const decimals = (String(step).split('.')[1] || '').length;
    const move = (ev) => {
      const dx = ev.clientX - startRef.current.x;
      const raw = startRef.current.val + dx * step;
      const snapped = Math.round(raw / step) * step;
      onChange(clamp(Number(snapped.toFixed(decimals))));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return (
    <div className="twk-num">
      <span className="twk-num-lbl" onPointerDown={onScrubStart}>{label}</span>
      <input type="number" value={value} min={min} max={max} step={step}
             onChange={(e) => onChange(clamp(Number(e.target.value)))} />
      {unit && <span className="twk-num-unit">{unit}</span>}
    </div>
  );
}

// Relative-luminance contrast pick — checkmarks drawn over a swatch need to
// read on both #111 and #fafafa without per-option configuration. Hex input
// only (#rgb / #rrggbb); named or rgb()/hsl() colors fall through to "light".
function __twkIsLight(hex) {
  const h = String(hex).replace('#', '');
  const x = h.length === 3 ? h.replace(/./g, (c) => c + c) : h.padEnd(6, '0');
  const n = parseInt(x.slice(0, 6), 16);
  if (Number.isNaN(n)) return true;
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return r * 299 + g * 587 + b * 114 > 148000;
}

const __TwkCheck = ({ light }) => (
  <svg viewBox="0 0 14 14" aria-hidden="true">
    <path d="M3 7.2 5.8 10 11 4.2" fill="none" strokeWidth="2.2"
          strokeLinecap="round" strokeLinejoin="round"
          stroke={light ? 'rgba(0,0,0,.78)' : '#fff'} />
  </svg>
);

// TweakColor — curated color/palette picker. Each option is either a single
// hex string or an array of 1-5 hex strings; the card adapts — a lone color
// renders solid, a palette renders colors[0] as the hero (left ~2/3) with the
// rest stacked in a sharp column on the right. onChange emits the
// option in the shape it was passed (string stays string, array stays array).
// Without options it falls back to the native color input for back-compat.
function TweakColor({ label, value, options, onChange }) {
  if (!options || !options.length) {
    return (
      <div className="twk-row twk-row-h">
        <div className="twk-lbl"><span>{label}</span></div>
        <input type="color" className="twk-swatch" value={value}
               onChange={(e) => onChange(e.target.value)} />
      </div>
    );
  }
  // Native <input type=color> emits lowercase hex per the HTML spec, so
  // compare case-insensitively. String() guards JSON.stringify(undefined),
  // which returns the primitive undefined (no .toLowerCase).
  const key = (o) => String(JSON.stringify(o)).toLowerCase();
  const cur = key(value);
  return (
    <TweakRow label={label}>
      <div className="twk-chips" role="radiogroup">
        {options.map((o, i) => {
          const colors = Array.isArray(o) ? o : [o];
          const [hero, ...rest] = colors;
          const sup = rest.slice(0, 4);
          const on = key(o) === cur;
          return (
            <button key={i} type="button" className="twk-chip" role="radio"
                    aria-checked={on} data-on={on ? '1' : '0'}
                    aria-label={colors.join(', ')} title={colors.join(' · ')}
                    style={{ background: hero }}
                    onClick={() => onChange(o)}>
              {sup.length > 0 && (
                <span>
                  {sup.map((c, j) => <i key={j} style={{ background: c }} />)}
                </span>
              )}
              {on && <__TwkCheck light={__twkIsLight(hero)} />}
            </button>
          );
        })}
      </div>
    </TweakRow>
  );
}

function TweakButton({ label, onClick, secondary = false }) {
  return (
    <button type="button" className={secondary ? 'twk-btn secondary' : 'twk-btn'}
            onClick={onClick}>{label}</button>
  );
}

Object.assign(window, {
  useTweaks, TweaksPanel, TweakSection, TweakRow,
  TweakSlider, TweakToggle, TweakRadio, TweakSelect,
  TweakText, TweakNumber, TweakColor, TweakButton,
});

// ---- Legacy section 3 ----
// Shared UI primitives + icons
const Icon = ({ name, size = 18 }) => {
  const paths = {
    dashboard: <><path d="M3 12h6V3H3zM3 21h6v-6H3zM15 21h6V12h-6zM15 9h6V3h-6z"/></>,
    students:  <><circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5"/><circle cx="17" cy="7" r="2.5"/><path d="M22 17c0-2.5-1.8-4-4.5-4"/></>,
    schedule:  <><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></>,
    attendance:<><path d="M9 11l2.5 2.5L17 8"/><rect x="3.5" y="4" width="17" height="16" rx="2"/></>,
    groups:    <><circle cx="7" cy="8" r="3"/><circle cx="17" cy="8" r="3"/><path d="M2 19c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5M12 19c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5"/></>,
    parent:    <><path d="M21 10c0 6-9 11-9 11s-9-5-9-11a5 5 0 019-3 5 5 0 019 3z"/></>,
    settings:  <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.4 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.4 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.9.4l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.4-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.4-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.4H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.4l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.4 1.9V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></>,
    search:    <><circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/></>,
    plus:      <><path d="M12 5v14M5 12h14"/></>,
    bell:      <><path d="M6 8a6 6 0 1112 0c0 7 3 7 3 9H3c0-2 3-2 3-9zM10 21a2 2 0 004 0"/></>,
    chevron:   <><path d="M9 6l6 6-6 6"/></>,
    chevronL:  <><path d="M15 6l-6 6 6 6"/></>,
    download:  <><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></>,
    edit:      <><path d="M15 4l5 5L9 20H4v-5z"/></>,
    lock:      <><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 118 0v4"/></>,
    unlock:    <><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 017-2.6"/></>,
    share:     <><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8 11l8-4M8 13l8 4"/></>,
    phone:     <><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/></>,
    sparkle:   <><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z"/></>,
    book:      <><path d="M4 4h7v16H4zM13 4h7v16h-7zM4 8h7M13 8h7"/></>,
    check:     <><path d="M5 12l5 5L20 7"/></>,
    x:         <><path d="M6 6l12 12M18 6L6 18"/></>,
    arrow:     <><path d="M5 12h14m-5-5l5 5-5 5"/></>,
    filter:    <><path d="M3 6h18M6 12h12M10 18h4"/></>,
    dots:      <><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></>,
    print:     <><rect x="6" y="3" width="12" height="6" rx="1"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="15" width="12" height="7" rx="1"/></>,
    cal:       <><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></>,
    archive:   <><rect x="3" y="4" width="18" height="4" rx="1"/><rect x="5" y="8" width="14" height="12" rx="1"/><path d="M10 13h4"/></>,
    logout:    <><path d="M10 5H5a2 2 0 00-2 2v10a2 2 0 002 2h5M14 8l4 4-4 4M8 12h10"/></>,
  };
  return (
    <svg className="ico" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {paths[name] || null}
    </svg>
  );
};

const Pill = ({ tone = 'default', dot = false, children }) => (
  <span className={`pill ${tone === 'default' ? '' : tone} ${dot ? 'dot' : ''}`}>{children}</span>
);

const Initials = (name) => {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};

const formatPhone = (p) => p;

// expose
Object.assign(window, { Icon, Pill, Initials, formatPhone });

// ---- Legacy section 4 ----
// Shared app context (actions + sheet/modal/toast state) + sheet/modal renderers
const AppCtx = React.createContext(null);
const useApp = () => React.useContext(AppCtx);

const AppProvider = ({ value, children }) => (
  <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
);

// ---------- Lesson roster (bulk conduct UI) ----------
// Used inside LessonDetailSheet for one concrete dated session.
// For each student: shows the subscription slot for that exact date.
// Save batches updates through window.MK_STORE.updateStudent.
const _LR_initials = (name) => name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

const LessonRoster = ({ rosterStudents, notify, session }) => {
  const [drafts, setDrafts] = React.useState({}); // {sid: {status, note}}
  const STATUSES = window.MK_LESSON_STATUSES;
  const LABELS = window.MK_LESSON_LABELS;

  const update = (sid, patch) => setDrafts(d => ({ ...d, [sid]: { ...d[sid], ...patch } }));

  const apply = () => {
    const changedAt = new Date().toISOString();
    const pending = rosterStudents.flatMap((st) => {
      const draft = drafts[st.id];
      if (!draft?.status) return [];
      const stored = window.MK_STORE.getStudent(st.id);
      const subscription = getProfileSubscriptionView(st.id, 'main');
      const idx = findLessonIndexForSession(subscription, session);
      return stored?.lessons?.[idx] ? [{ st, draft, stored, idx }] : [];
    });

    try {
      pending.forEach(({ st, draft, idx }) => {
        validateLegacyLessonStatusChange({
          store: window.MK_STORAGE_MIGRATION?.store,
          studentId: st.id,
          activeSubId: 'main',
          lessonIndex: idx,
          legacyStatus: draft.status,
          note: draft.note || '',
          changedAt,
        });
      });
    } catch (error) {
      notify && notify(error.message || 'Не удалось проверить проводку', 'err');
      return;
    }

    pending.forEach(({ st, draft, stored, idx }) => {
      const lessons = [...stored.lessons];
      lessons[idx] = { ...lessons[idx], status: draft.status, note: draft.note || '' };
      const events = [...(stored.events || []), {
        type: draft.status,
        date: new Date().toLocaleDateString('ru-RU'),
        note: `${LABELS[draft.status] || draft.status} (${lessons[idx].date})${draft.note ? ' → ' + draft.note : ''}`
      }];
      window.MK_STORE.updateStudent(st.id, s => ({ ...s, lessons, events }));
    });

    const saved = pending.length;
    setDrafts({});
    if (saved === 0) {
      notify && notify('Выберите статус хотя бы у одного ученика');
    } else {
      const word = saved === 1 ? 'ученик' : (saved >= 2 && saved <= 4) ? 'ученика' : 'учеников';
      notify && notify(`Проводка сохранена: ${saved} ${word}`);
    }
  };

  const draftCount = Object.values(drafts).filter(d => d && d.status).length;

  return (
    <div style={{borderTop:'1px dashed var(--rule)', paddingTop:18, marginTop:18}}>
      <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:14}}>
        <h3 style={{fontFamily:'Instrument Serif', fontSize:22, margin:0}}>Проводка <em style={{color:'var(--forest)'}}>занятия</em></h3>
        <span style={{fontFamily:'JetBrains Mono', fontSize:10, letterSpacing:'.14em', color:'var(--ink-faint)', textTransform:'uppercase'}}>
          {draftCount > 0 ? `выбрано: ${draftCount}` : 'отметьте за всех'}
        </span>
      </div>

      <div style={{display:'flex', flexDirection:'column', gap:14}}>
        {rosterStudents.map(st => {
          const subscription = getProfileSubscriptionView(st.id, 'main');
          const lessonIdx = findLessonIndexForSession(subscription, session);
          const lesson = lessonIdx >= 0 ? subscription.lessons[lessonIdx] : null;
          const draft = drafts[st.id] || {};
          const noLessonForDate = !lesson;
          const sessionDate = session?.startsAt?.slice(0, 10);
          return (
            <div key={st.id} style={{
              padding:'12px 14px', border:'1px solid var(--rule)', borderRadius:12,
              background: draft.status ? 'var(--moss-pale)' : 'var(--paper-card)',
              transition:'background .15s',
            }}>
              <div style={{display:'flex', alignItems:'center', gap:12, marginBottom: noLessonForDate ? 0 : 10}}>
                <div className="av" style={{color: st.spine, width:36, height:36, fontSize:13}}>{_LR_initials(st.name)}</div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:14, fontWeight:600}}>{st.name}</div>
                  <div style={{fontFamily:'JetBrains Mono', fontSize:10, color:'var(--ink-faint)', letterSpacing:'.08em', marginTop:2}}>
                    {lesson
                      ? `СЛОТ ${lesson.date} · ТЕКУЩИЙ: ${LABELS[lesson.status] || lesson.status}`
                      : `НЕТ СЛОТА НА ${sessionDate?.split('-').reverse().join('.') || 'ЭТУ ДАТУ'}`}
                  </div>
                </div>
              </div>

              {!noLessonForDate && (
                <>
                  <div style={{display:'flex', flexWrap:'wrap', gap:5}}>
                    {STATUSES.map(s => {
                      const on = draft.status === s.k;
                      return (
                        <button
                          key={s.k}
                          onClick={() => update(st.id, { status: on ? undefined : s.k })}
                          title={s.label}
                          style={{
                            padding:'5px 10px', borderRadius:999, fontSize:11.5, cursor:'pointer',
                            border:'1px solid ' + (on ? s.color : 'var(--rule)'),
                            background: on ? s.color : 'transparent',
                            color: on ? 'oklch(0.97 0.02 85)' : s.color,
                            fontFamily:'Manrope, sans-serif', fontWeight: on ? 600 : 500,
                            transition:'all .12s',
                          }}
                        >{s.label}</button>
                      );
                    })}
                  </div>
                  {draft.status && (
                    <input
                      value={draft.note || ''}
                      onChange={e => update(st.id, { note: e.target.value })}
                      placeholder="комментарий (необязательно) — напр. отработка 23.05"
                      style={{
                        width:'100%', marginTop:10, padding:'8px 11px', border:'1px solid var(--rule)',
                        borderRadius:8, fontFamily:'Manrope', fontSize:12.5, outline:'none',
                        background:'var(--paper-deep)', color:'var(--ink)',
                      }}
                    />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      <div style={{display:'flex', justifyContent:'flex-end', marginTop:14}}>
        <button className="btn btn-sm btn-primary" onClick={apply} disabled={draftCount === 0}
          style={{opacity: draftCount === 0 ? 0.5 : 1}}>
          <Icon name="check" size={13}/> Сохранить проводку{draftCount > 0 ? ` · ${draftCount}` : ''}
        </button>
      </div>
    </div>
  );
};

// ---------- Sheet shell ----------
const Sheet = ({ eyebrow, title, titleEm, onClose, foot, children }) => {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <>
      <div className="sheet-scrim" onClick={onClose}></div>
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="sheet-head">
          <div>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            <h2>{title}{titleEm && <> <em>{titleEm}</em></>}</h2>
          </div>
          <button className="sheet-close" onClick={onClose} aria-label="Закрыть">
            <Icon name="x" size={14}/>
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {foot && <div className="sheet-foot">{foot}</div>}
      </div>
    </>
  );
};

// ---------- Modal shell ----------
const Modal = ({ eyebrow, title, titleEm, onClose, foot, children }) => {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-scrim" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h2>{title}{titleEm && <> <em>{titleEm}</em></>}</h2>
        </div>
        <div className="modal-body">{children}</div>
        {foot && <div className="modal-foot">{foot}</div>}
      </div>
    </div>
  );
};

// ---------- Record Lesson ----------
const RecordLessonSheet = ({ initialStudentId, onClose, notify }) => {
  const { students, subjects } = window.MK_DATA;
  const _todayISO = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
  const [studentId, setStudentId] = React.useState(initialStudentId || students[0].id);
  const [subject, setSubject] = React.useState(subjects[0]);
  const [date, setDate] = React.useState(_todayISO);
  const [time, setTime] = React.useState('09:00');
  const [dur, setDur] = React.useState('60');
  const [topic, setTopic] = React.useState('');

  const submit = () => {
    const st = students.find(s => s.id === studentId);
    if (!st) { notify('Ученик не найден', 'err'); return; }
    const [h, m] = time.split(':').map(Number);
    const start = h + m / 60;
    const end = start + (parseInt(dur, 10) || 60) / 60;
    const jsDay = new Date(date + 'T00:00:00').getDay();
    const day = (jsDay + 6) % 7;
    const lesson = {
      day, start, end,
      studentId: st.id,
      subject,
      tone: subject === 'Чтение' || subject === 'Развитие речи' ? 'green'
          : subject === 'Математика' || subject === 'Логика' ? 'ochre'
          : subject === 'Письмо' || subject === 'Окружающий мир' ? 'sky'
          : subject === 'Английский' ? 'violet' : 'green',
      note: topic || '',
    };
    window.MK_SCHEDULE.addExtra(date, lesson);
    onClose();
    notify(`Урок записан: ${st.short} · ${subject} · ${date.split('-').reverse().join('.')} ${time}`, 'ok');
  };

  return (
    <Sheet
      eyebrow="новая запись · ежедневник"
      title="Записать"
      titleEm="урок"
      onClose={onClose}
      foot={<>
        <span className="grow"></span>
        <button className="btn btn-sm" onClick={onClose}>Отмена</button>
        <button className="btn btn-sm btn-primary" onClick={submit}>
          <Icon name="check" size={13}/> Записать в ежедневник
        </button>
      </>}
    >
      <div className="fld">
        <label>Ученик или группа</label>
        <select value={studentId} onChange={e => setStudentId(e.target.value)}>
          {students.map(s => <option key={s.id} value={s.id}>{s.name} · {s.group}</option>)}
        </select>
      </div>
      <div className="fld">
        <label>Предмет</label>
        <div className="choices">
          {subjects.map(sb => (
            <button key={sb} className={`choice ${subject === sb ? 'on' : ''}`} onClick={() => setSubject(sb)}>{sb}</button>
          ))}
        </div>
      </div>
      <div className="fld-row">
        <div className="fld">
          <label>Дата</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="fld">
          <label>Начало</label>
          <input type="time" value={time} onChange={e => setTime(e.target.value)} />
        </div>
      </div>
      <div className="fld">
        <label>Длительность</label>
        <div className="choices">
          {['30','45','60','90'].map(d => (
            <button key={d} className={`choice ${dur === d ? 'on' : ''}`} onClick={() => setDur(d)}>{d} мин</button>
          ))}
        </div>
      </div>
      <div className="fld">
        <label>Тема урока</label>
        <textarea value={topic} onChange={e => setTopic(e.target.value)} placeholder="Состав числа 8, чтение «Зима»…" />
      </div>
    </Sheet>
  );
};

// ---------- Lesson detail (clicked block / row) ----------
const LessonDetailSheet = ({ lesson, onClose, notify }) => {
  const { students, groups } = window.MK_DATA;
  const entity = lesson.group
    ? groups.find(g => g.id === lesson.groupId)
    : students.find(s => s.id === lesson.studentId);
  const name = entity ? (lesson.group ? entity.name : entity.name) : 'Урок';
  const fmt = (h) => `${Math.floor(h).toString().padStart(2,'0')}:${((h%1)*60).toString().padStart(2,'0')}`;
  const canToggle = lesson.date && lesson.id;
  const isCancelled = canToggle ? window.MK_SCHEDULE.isCancelled(lesson.date, lesson.id) : !!lesson.canceled;
  const roster = lesson.group
    ? students.filter(s => s.groupId === lesson.groupId)
    : (entity ? [entity] : []);
  const session = lesson.date ? createSessionFromScheduleBlock(lesson) : null;

  // Reschedule state
  const [reschedMode, setReschedMode] = React.useState(false);
  const [newDate, setNewDate] = React.useState(lesson.date || window.MK_SCHEDULE.fmtDate(new Date()));
  const [newTime, setNewTime] = React.useState(fmt(lesson.start));
  const [newDur, setNewDur] = React.useState(String(Math.round((lesson.end - lesson.start) * 60)));

  const canReschedule = !!(lesson.date && lesson.id) && !isCancelled;

  const applyReschedule = () => {
    const [h, m] = newTime.split(':').map(Number);
    const startH = h + m/60;
    const endH = startH + (parseInt(newDur, 10) || 60) / 60;
    // 1) Удаляем оригинал с этой даты
    const isExtra = String(lesson.id).startsWith('e_');
    if (isExtra) {
      window.MK_SCHEDULE.removeExtra(lesson.date, lesson.id);
    } else if (!window.MK_SCHEDULE.isCancelled(lesson.date, lesson.id)) {
      window.MK_SCHEDULE.toggleCancel(lesson.date, lesson.id);
    }
    // 2) Создаём новый extra на target дату
    const { id: _id, date: _d, canceled: _c, day: _day, dayName: _dn, ...base } = lesson;
    const dayMapJs = (d) => { const u = new Date(d + 'T00:00:00'); return (u.getDay() + 6) % 7; };
    const newLesson = {
      ...base,
      start: startH, end: endH,
      day: dayMapJs(newDate),
      note: `перенос с ${lesson.date} ${fmt(lesson.start)}`,
    };
    window.MK_SCHEDULE.addExtra(newDate, newLesson);
    notify(`Перенесено на ${newDate.split('-').reverse().join('.')} в ${newTime}`);
    onClose();
  };

  return (
    <Sheet
      eyebrow={`${lesson.dayName || ''} · ${fmt(lesson.start)} – ${fmt(lesson.end)}`}
      title={lesson.subject}
      titleEm=""
      onClose={onClose}
      foot={reschedMode ? (
        <>
          <button className="btn btn-sm" onClick={() => setReschedMode(false)}>Отмена</button>
          <span className="grow"></span>
          <button className="btn btn-sm btn-primary" onClick={applyReschedule}>
            <Icon name="check" size={13}/> Перенести
          </button>
        </>
      ) : (() => {
        const isExtra = String(lesson.id || '').startsWith('e_');
        return (
        <>
          {isExtra ? (
            <button className="btn btn-sm" onClick={() => {
              if (!window.confirm('Удалить этот урок совсем? Восстановить нельзя будет.')) return;
              window.MK_SCHEDULE.removeExtra(lesson.date, lesson.id);
              notify('Урок удалён', 'ok');
              onClose();
            }} style={{color:'var(--berry)'}}>
              <Icon name="x" size={13}/> Удалить
            </button>
          ) : (
            <button className="btn btn-sm" onClick={() => {
              if (canToggle) {
                window.MK_SCHEDULE.toggleCancel(lesson.date, lesson.id);
                notify(isCancelled ? 'Урок восстановлен' : 'Урок отменён на эту дату', 'ok');
              } else {
                notify('Урок отменён', 'ok');
              }
              onClose();
            }}>{isCancelled ? 'Восстановить' : 'Отменить'}</button>
          )}
          <span className="grow"></span>
          {canReschedule && (
            <button className="btn btn-sm" onClick={() => setReschedMode(true)}>
              <Icon name="arrow" size={13}/> Перенести
            </button>
          )}
        </>
        );
      })()}
    >
      <div className="kv-row">
        <div className="k">Кто</div>
        <div className="v">
          <div style={{fontWeight: 600}}>{name}</div>
          {entity && lesson.group && <div style={{fontSize: 12, color: 'var(--ink-faint)'}}>{students.filter(s => s.groupId === entity.id).length} учеников · {entity.room}</div>}
          {entity && !lesson.group && <div style={{fontSize: 12, color: 'var(--ink-faint)'}}>{getAge(entity) != null ? `${getAge(entity)} лет · ` : ''}{entity.group}</div>}
        </div>
      </div>
      <div className="kv-row">
        <div className="k">Время</div>
        <div className="v">{fmt(lesson.start)} – {fmt(lesson.end)} · {Math.round((lesson.end - lesson.start) * 60)} мин</div>
      </div>
      <div className="kv-row">
        <div className="k">Тема</div>
        <div className="v">{lesson.subject}</div>
      </div>
      <div className="kv-row">
        <div className="k">Статус</div>
        <div className="v">
          {isCancelled ? <Pill tone="berry" dot>отменён</Pill> : <Pill tone="green" dot>в плане</Pill>}
        </div>
      </div>

      {reschedMode && (
        <div style={{
          marginTop:18, padding:'16px 18px', border:'1px solid var(--forest)', borderRadius:12,
          background:'var(--moss-pale)',
        }}>
          <div style={{
            fontFamily:'JetBrains Mono', fontSize:10, letterSpacing:'.14em', textTransform:'uppercase',
            color:'var(--ink-faint)', marginBottom:10,
          }}>Перенос занятия</div>
          <div className="fld-row">
            <div className="fld" style={{marginBottom:10}}>
              <label>Новая дата</label>
              <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
            </div>
            <div className="fld" style={{marginBottom:10}}>
              <label>Новое время</label>
              <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} />
            </div>
          </div>
          <div className="fld" style={{marginBottom:0}}>
            <label>Длительность</label>
            <div className="choices">
              {['30','45','60','90'].map(d => (
                <button key={d} className={`choice ${newDur === d ? 'on' : ''}`} onClick={() => setNewDur(d)}>{d} мин</button>
              ))}
            </div>
          </div>
          <div style={{fontSize:11.5, color:'var(--ink-soft)', marginTop:12, fontStyle:'italic'}}>
            Урок на {lesson.date && lesson.date.split('-').reverse().join('.')} будет отменён,
            а на новой дате появится экземпляр с пометкой «перенос».
          </div>
        </div>
      )}

      {!reschedMode && !isCancelled && roster.length > 0 && (
        <LessonRoster rosterStudents={roster} notify={notify} session={session} />
      )}
    </Sheet>
  );
};

// ---------- Contact parent ----------
const ContactSheet = ({ student, contact, onClose, notify }) => {
  // contact может прийти как пропс (конкретный контакт) или fallback на legacy поля
  const ct = contact || { name: student.parent || '', phone: student.phone || '', role: '' };
  const nameParts = (ct.name || '').split(' ');
  const cleanPhone = (ct.phone || '').replace(/[^\d+]/g, '');
  const actions = [
    { ic:'phone', name:'Позвонить', sub: ct.phone,
      run: () => { window.location.href = `tel:${cleanPhone}`; notify('Открываю набор номера', 'ok'); } },
    { ic:'share', name:'WhatsApp', sub:'мессенджер',
      run: () => { const n = cleanPhone.startsWith('+') ? cleanPhone.slice(1) : cleanPhone.replace(/^8/,'7'); window.open(`https://wa.me/${n}`,'_blank'); notify('Открываю WhatsApp','ok'); } },
    { ic:'edit', name:'Скопировать', sub:'номер в буфер',
      run: () => { if (navigator.clipboard) { navigator.clipboard.writeText(ct.phone).then(()=>notify('Номер скопирован','ok'),()=>notify('Не удалось скопировать','err')); } else notify('Буфер обмена недоступен','err'); } },
    { ic:'bell', name:'Напомнить мне', sub:'через 1 час',
      run: () => notify('Напоминание поставлено','ok') },
  ];
  return (
    <Sheet eyebrow={ct.role || 'связь с родителем'} title={nameParts[0]} titleEm={nameParts.slice(1).join(' ')} onClose={onClose}>
      <div className="kv-row"><div className="k">Ученик</div><div className="v">{student.name}{getAge(student)!=null?` · ${getAge(student)} лет`:''}</div></div>
      <div className="kv-row"><div className="k">Телефон</div><div className="v font-mono">{ct.phone}</div></div>
      <div style={{marginTop:18}}>
        <div className="eyebrow" style={{fontFamily:'JetBrains Mono',fontSize:10.5,letterSpacing:'.16em',color:'var(--ink-faint)',textTransform:'uppercase',marginBottom:10}}>как связаться</div>
        <div className="contact-actions">
          {actions.map(a => (
            <button key={a.name} className="contact-act" onClick={()=>a.run()}>
              <span className="ic-circle"><Icon name={a.ic} size={15}/></span>
              <span className="name">{a.name}</span>
              <span className="sub">{a.sub}</span>
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
};

// ---------- Contact edit modal ----------
const ContactEditModal = ({ student, contact, onClose, notify }) => {
  // contact = null → добавляем новый; иначе редактируем
  const isNew = !contact;
  const [name,  setName]  = React.useState(contact?.name  || '');
  const [phone, setPhone] = React.useState(contact?.phone || '');
  const [role,  setRole]  = React.useState(contact?.role  || '');

  const _getContacts = (s) => {
    if (s.contacts && s.contacts.length) return s.contacts;
    if (s.parent) return [{ id: 'ct_main', name: s.parent, phone: s.phone || '', role: 'родитель' }];
    return [];
  };

  const save = () => {
    if (!name.trim()) { notify('Укажите имя', 'err'); return; }
    const stored = window.MK_STORE.getStudent(student.id);
    const existing = _getContacts(stored);
    let updated;
    if (isNew) {
      updated = [...existing, { id: 'ct_' + Date.now(), name: name.trim(), phone: phone.trim(), role: role.trim() }];
    } else {
      updated = existing.map(c => c.id === contact.id ? { ...c, name: name.trim(), phone: phone.trim(), role: role.trim() } : c);
    }
    window.MK_STORE.updateStudent(student.id, d => ({ ...d, contacts: updated }));
    notify(isNew ? 'Контакт добавлен' : 'Контакт обновлён', 'ok');
    onClose();
  };

  return (
    <Modal eyebrow={student.short} title={isNew ? 'Добавить' : 'Изменить'} titleEm="контакт" onClose={onClose}
      foot={<>
        <button className="btn btn-sm" onClick={onClose}>Отмена</button>
        <button className="btn btn-sm btn-primary" onClick={save}><Icon name="check" size={13}/> Сохранить</button>
      </>}
    >
      <div className="fld">
        <label>Имя</label>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Мария Соколова" autoFocus />
      </div>
      <div className="fld">
        <label>Телефон</label>
        <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+7 900 000 00 00" type="tel" />
      </div>
      <div className="fld">
        <label>Роль</label>
        <div className="choices" style={{flexWrap:'wrap'}}>
          {['мама','папа','бабушка','дедушка','опекун'].map(r => (
            <button key={r} className={`choice ${role===r?'on':''}`} onClick={()=>setRole(r)}>{r}</button>
          ))}
        </div>
        <input value={role} onChange={e=>setRole(e.target.value)} placeholder="или введите свою роль" style={{marginTop:8}} />
      </div>
    </Modal>
  );
};

// ---------- Renew pack ----------
const RenewModal = ({ student, onClose, notify }) => {
  const [packSize, setPackSize] = React.useState(8);
  const prices = { 4: 6400, 6: 9600, 8: 12800, 12: 19200 };
  const [customPrice, setCustomPrice] = React.useState(prices[8]);

  // Есть ли ещё будущие уроки в текущем пакете?
  const futureLessons = (student.lessons || []).filter(l => l.status === 'future' || l.status === 'sick-wait');
  const hasFuture = futureLessons.length > 0;

  // Дефолтная дата старта: если есть будущие уроки — день после последнего, иначе сегодня
  const _isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const _todayISO = _isoDate(new Date());
  const _defaultStart = (() => {
    if (!hasFuture) return _todayISO;
    const last = futureLessons[futureLessons.length - 1].date; // DD.MM
    const [dd, mm] = last.split('.');
    const d = new Date(`${new Date().getFullYear()}-${mm}-${dd}T00:00:00`);
    d.setDate(d.getDate() + 1);
    return _isoDate(d);
  })();

  const [startDate, setStartDate] = React.useState(_defaultStart);
  const [payStatus, setPayStatus] = React.useState('paid');
  const [payMethod, setPayMethod] = React.useState('СБП');

  // Какие дни недели у ученика. Если пусто — Пн/Ср/Пт по умолчанию
  const targetDays = (student.days && student.days.length) ? student.days : [1,3,5];

  const generateLessons = (n, fromDateISO) => {
    const lessons = [];
    const d = new Date(fromDateISO + 'T00:00:00');
    let guard = 0;
    while (lessons.length < n && guard < 400) {
      if (targetDays.includes(d.getDay())) {
        const dd = String(d.getDate()).padStart(2,'0');
        const mm = String(d.getMonth()+1).padStart(2,'0');
        lessons.push({ date: `${dd}.${mm}`, status: 'future', note: '' });
      }
      d.setDate(d.getDate() + 1);
      guard++;
    }
    return lessons;
  };

  const previewLessons = generateLessons(packSize, startDate);
  const lastDate = previewLessons.length ? previewLessons[previewLessons.length - 1].date : '—';

  const apply = () => {
    const stored = window.MK_STORE.getStudent(student.id);
    if (!stored) { notify('Ученик не найден', 'err'); return; }
    const amount = customPrice;
    const todayHuman = new Date().toLocaleDateString('ru-RU');
    const eventType = payStatus === 'paid' ? 'payment' : 'payment-pending';
    const noteSuffix = payStatus === 'paid'
      ? `Оплата · ${packSize} занятий — ${amount.toLocaleString('ru-RU')} ₽ · ${payMethod}`
      : `Ждёт оплаты · ${packSize} занятий — ${amount.toLocaleString('ru-RU')} ₽`;
    const newEvent = { type: eventType, date: todayHuman, note: noteSuffix };

    if (hasFuture) {
      // Очередь: текущий пакет ещё идёт — сохраняем следующий, он стартует автоматически
      window.MK_STORE.updateStudent(student.id, d => ({
        ...d,
        events: [...(d.events || []), newEvent],
        queuedPack: {
          packSize,
          startDate,
          ...(payStatus === 'paid' ? { paid: todayHuman } : {}),
          events: [newEvent],
        },
      }));
      notify(
        payStatus === 'paid'
          ? `Пакет ${packSize} уроков в очереди · ${amount.toLocaleString('ru-RU')} ₽ оплачено`
          : `Пакет ${packSize} уроков в очереди · ждём оплату`,
        'ok'
      );
    } else {
      // Немедленная активация: будущих уроков нет
      const oldLessons = stored.lessons || [];
      const oldDone = oldLessons.filter(l => l.status === 'done' || l.status === 'absent');
      const archivedLessons = [...(stored.archivedLessons || []), ...oldDone];
      const update = {
        ...stored,
        lessons: previewLessons,
        pack: packSize,
        used: 0,
        status: 'active',
        archivedLessons,
        ...(payStatus === 'paid' ? { paid: todayHuman } : {}),
        events: [...(stored.events || []), newEvent],
        queuedPack: null,
      };
      window.MK_STORE.updateStudent(student.id, update);
      notify(
        payStatus === 'paid'
          ? `Новый пакет ${packSize} уроков · ${amount.toLocaleString('ru-RU')} ₽ оплачено`
          : `Новый пакет ${packSize} уроков · ждём оплату ${amount.toLocaleString('ru-RU')} ₽`,
        'ok'
      );
    }
    onClose();
  };

  return (
    <Modal
      eyebrow={`Пакет для ${student.short}`}
      title="Продлить"
      titleEm="пакет"
      onClose={onClose}
      foot={<>
        <button className="btn btn-sm" onClick={onClose}>Отмена</button>
        <button className="btn btn-sm btn-primary" onClick={apply}>
          <Icon name="check" size={13}/>
          {hasFuture
            ? (payStatus === 'paid' ? 'В очередь и записать оплату' : 'В очередь (без оплаты)')
            : (payStatus === 'paid' ? 'Продлить и записать оплату' : 'Продлить (без оплаты)')}
        </button>
      </>}
    >
      {hasFuture && (
        <div style={{padding:'8px 12px', background:'var(--sky-pale)', border:'1px solid var(--sky)', borderRadius:8, fontSize:12, color:'var(--ink-soft)', marginBottom:4}}>
          Текущий пакет ещё идёт — новый встанет в очередь и стартует автоматически после последнего урока
        </div>
      )}
      <div className="fld">
        <label>Размер пакета</label>
        <div className="choices">
          {[4,6,8,12].map(n => (
            <button key={n} className={`choice ${packSize === n ? 'on' : ''}`} onClick={() => { setPackSize(n); setCustomPrice(prices[n]); }}>
              {n} уроков · {prices[n].toLocaleString('ru-RU')} ₽
            </button>
          ))}
        </div>
      </div>
      <div className="fld">
        <label>Сумма к оплате ₽</label>
        <input type="number" min="0" step="100" value={customPrice} onChange={e => setCustomPrice(parseInt(e.target.value) || 0)} />
      </div>
      <div className="fld">
        <label>{hasFuture ? 'Дата старта следующего пакета' : 'Дата активации (первый урок)'}</label>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
      </div>
      <div className="fld">
        <label>Оплата</label>
        <div className="choices">
          <button className={`choice ${payStatus === 'paid' ? 'on' : ''}`} onClick={() => setPayStatus('paid')}>✓ Оплачено</button>
          <button className={`choice ${payStatus === 'pending' ? 'on' : ''}`} onClick={() => setPayStatus('pending')}>⌛ Ждёт оплаты</button>
        </div>
      </div>
      {payStatus === 'paid' && (
        <div className="fld">
          <label>Способ оплаты</label>
          <div className="choices">
            {['СБП','Карта','Наличные'].map(m => (
              <button key={m} className={`choice ${payMethod === m ? 'on' : ''}`} onClick={() => setPayMethod(m)}>{m}</button>
            ))}
          </div>
        </div>
      )}
      <div className="kv-row">
        <div className="k">Текущий пакет</div>
        <div className="v">
          {student.used} из {student.pack} использовано · осталось {student.pack - student.used}
          {hasFuture && <div style={{fontSize:11, color:'var(--sky)', marginTop:4, fontStyle:'italic'}}>следующий {packSize} уроков стартует после последнего урока текущего</div>}
        </div>
      </div>
      <div className="kv-row">
        <div className="k">Расписание</div>
        <div className="v">по {targetDays.map(d => ['вс','пн','вт','ср','чт','пт','сб'][d]).join(' / ')}</div>
      </div>
      <div className="kv-row">
        <div className="k">К оплате</div>
        <div className="v font-mono" style={{fontWeight:600, fontSize:15}}>{customPrice.toLocaleString('ru-RU')} ₽</div>
      </div>
      <div className="kv-row">
        <div className="k">Последний урок нового пакета</div>
        <div className="v">примерно {lastDate}</div>
      </div>
    </Modal>
  );
};

// ---------- Individual lesson ----------
const AddIndividualLessonModal = ({ student, onClose, notify }) => {
  const _isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const [date, setDate]       = React.useState(_isoDate(new Date()));
  const [time, setTime]       = React.useState('15:00');
  const [subject, setSubject] = React.useState('');
  const [price, setPrice]     = React.useState(1600);
  const [payStatus, setPay]   = React.useState('paid');
  const [payMethod, setMethod]= React.useState('СБП');
  const [note, setNote]       = React.useState('');

  const apply = () => {
    const todayHuman = new Date().toLocaleDateString('ru-RU');
    window.MK_STORE.addIndividualLesson(student.id, {
      date, time,
      subject: subject.trim() || 'Разовый урок',
      price,
      status: 'future',
      note: note.trim(),
      ...(payStatus === 'paid' ? { paid: todayHuman, payMethod } : {}),
    });
    notify(`Разовый урок записан`, 'ok');
    onClose();
  };

  return (
    <Modal eyebrow={student.short} title="Разовый" titleEm="урок" onClose={onClose}
      foot={<>
        <button className="btn btn-sm" onClick={onClose}>Отмена</button>
        <button className="btn btn-sm btn-primary" onClick={apply}><Icon name="check" size={13}/> Записать</button>
      </>}
    >
      <div className="fld">
        <label>Предмет / тема</label>
        <input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Консультация, Пробный урок…" autoFocus />
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
        <div className="fld">
          <label>Дата</label>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} />
        </div>
        <div className="fld">
          <label>Время</label>
          <input type="time" value={time} onChange={e=>setTime(e.target.value)} />
        </div>
      </div>
      <div className="fld">
        <label>Стоимость (₽)</label>
        <input type="number" value={price} onChange={e=>setPrice(+e.target.value)} min={0} step={100} />
      </div>
      <div className="fld">
        <label>Оплата</label>
        <div className="choices">
          <button className={`choice ${payStatus==='paid'?'on':''}`} onClick={()=>setPay('paid')}>✓ Оплачено</button>
          <button className={`choice ${payStatus==='pending'?'on':''}`} onClick={()=>setPay('pending')}>⌛ Ждёт оплаты</button>
        </div>
      </div>
      {payStatus === 'paid' && (
        <div className="fld">
          <label>Способ оплаты</label>
          <div className="choices">
            {['СБП','Карта','Наличные'].map(m=>(
              <button key={m} className={`choice ${payMethod===m?'on':''}`} onClick={()=>setMethod(m)}>{m}</button>
            ))}
          </div>
        </div>
      )}
      <div className="fld">
        <label>Комментарий</label>
        <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Необязательно" />
      </div>
    </Modal>
  );
};

// ---------- Add extra sub ----------
const AddExtraSubModal = ({ student, onClose, notify }) => {
  const DAY_LABELS = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
  const _isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const _todayISO = _isoDate(new Date());

  const groups = window.MK_STORE.groups || [];

  const [groupId,   setGroupId]  = React.useState('');       // '' = индивидуальный
  const [subject,   setSubject]  = React.useState('');
  const [days,      setDays]     = React.useState([]);
  const [time,      setTime]     = React.useState('15:00');
  const [packSize,  setPackSize] = React.useState(8);
  const [price,     setPrice]    = React.useState(12800);
  const [startDate, setStart]    = React.useState(_todayISO);
  const [payStatus, setPay]      = React.useState('paid');
  const [payMethod, setMethod]   = React.useState('СБП');

  const selectedGroup = groups.find(g => g.id === groupId) || null;

  // При выборе группы — подтягиваем расписание и тему
  const pickGroup = (id) => {
    setGroupId(id);
    if (!id) return;
    const g = groups.find(g => g.id === id);
    if (!g) return;
    if (g.days)  setDays(g.days);
    if (g.time)  setTime(g.time);
    if (g.focus || g.name) setSubject(g.focus || g.name);
  };

  const toggleDay = (d) => setDays(prev => prev.includes(d) ? prev.filter(x=>x!==d) : [...prev, d]);

  const effectiveDays = selectedGroup ? (selectedGroup.days || days) : days;

  const generateLessons = (n, fromISO) => {
    const lessons = [];
    const d = new Date(fromISO + 'T00:00:00');
    let guard = 0;
    while (lessons.length < n && guard < 400) {
      if (effectiveDays.includes(d.getDay())) {
        const dd = String(d.getDate()).padStart(2,'0');
        const mm = String(d.getMonth()+1).padStart(2,'0');
        lessons.push({ date: `${dd}.${mm}`, status: 'future', note: '' });
      }
      d.setDate(d.getDate() + 1);
      guard++;
    }
    return lessons;
  };

  const apply = () => {
    const subjectVal = subject.trim() || (selectedGroup ? (selectedGroup.focus || selectedGroup.name) : '');
    if (!subjectVal) { notify('Укажите название предмета', 'err'); return; }
    if (!effectiveDays.length) { notify('Выберите хотя бы один день', 'err'); return; }
    const todayHuman = new Date().toLocaleDateString('ru-RU');
    const esub = {
      subject: subjectVal,
      days: effectiveDays,
      time: selectedGroup ? (selectedGroup.time || time) : time,
      pack: packSize,
      price,
      lessons: generateLessons(packSize, startDate),
      status: 'active',
      ...(groupId ? { groupId } : {}),
      ...(payStatus === 'paid' ? { paid: todayHuman } : {}),
    };
    window.MK_STORE.addExtraSub(student.id, esub);
    notify(`Абонемент «${esub.subject}» добавлен`, 'ok');
    onClose();
  };

  return (
    <Modal eyebrow={student.short} title="Добавить" titleEm="абонемент" onClose={onClose}
      foot={<>
        <button className="btn btn-sm" onClick={onClose}>Отмена</button>
        <button className="btn btn-sm btn-primary" onClick={apply}><Icon name="check" size={13}/> Добавить</button>
      </>}
    >
      {/* Выбор группы */}
      <div className="fld">
        <label>Группа</label>
        <div className="choices" style={{flexWrap:'wrap'}}>
          <button className={`choice ${groupId===''?'on':''}`} onClick={()=>pickGroup('')}>Индивидуально</button>
          {groups.map(g => (
            <button key={g.id} className={`choice ${groupId===g.id?'on':''}`} onClick={()=>pickGroup(g.id)}>
              {g.name}
            </button>
          ))}
        </div>
        {selectedGroup && (
          <div style={{fontSize:11,color:'var(--ink-faint)',marginTop:6,fontFamily:'JetBrains Mono'}}>
            {(selectedGroup.days||[]).map(d=>DAY_LABELS[d]).join('/')} · {selectedGroup.time} · {selectedGroup.focus}
          </div>
        )}
      </div>

      {/* Предмет — заполняется из группы, но редактируемый */}
      <div className="fld">
        <label>Предмет</label>
        <input value={subject} onChange={e=>setSubject(e.target.value)}
          placeholder={selectedGroup ? (selectedGroup.focus || selectedGroup.name) : 'Рисование, Труд, Английский…'} />
      </div>

      {/* Дни/время — только для индивидуального */}
      {!selectedGroup && (<>
        <div className="fld">
          <label>Дни занятий</label>
          <div className="choices" style={{flexWrap:'wrap'}}>
            {[1,2,3,4,5,6,0].map(d => (
              <button key={d} className={`choice ${days.includes(d)?'on':''}`} onClick={()=>toggleDay(d)}>{DAY_LABELS[d]}</button>
            ))}
          </div>
        </div>
        <div className="fld">
          <label>Время</label>
          <input type="time" value={time} onChange={e=>setTime(e.target.value)} />
        </div>
      </>)}

      <div className="fld">
        <label>Размер пакета</label>
        <div className="choices">
          {[4,6,8,12].map(n=>(
            <button key={n} className={`choice ${packSize===n?'on':''}`} onClick={()=>setPackSize(n)}>{n} уроков</button>
          ))}
        </div>
      </div>
      <div className="fld">
        <label>Стоимость пакета (₽)</label>
        <input type="number" value={price} onChange={e=>setPrice(+e.target.value)} min={0} step={100} />
      </div>
      <div className="fld">
        <label>Дата первого урока</label>
        <input type="date" value={startDate} onChange={e=>setStart(e.target.value)} />
      </div>
      <div className="fld">
        <label>Оплата</label>
        <div className="choices">
          <button className={`choice ${payStatus==='paid'?'on':''}`} onClick={()=>setPay('paid')}>✓ Оплачено</button>
          <button className={`choice ${payStatus==='pending'?'on':''}`} onClick={()=>setPay('pending')}>⌛ Ждёт оплаты</button>
        </div>
      </div>
      {payStatus === 'paid' && (
        <div className="fld">
          <label>Способ оплаты</label>
          <div className="choices">
            {['СБП','Карта','Наличные'].map(m=>(
              <button key={m} className={`choice ${payMethod===m?'on':''}`} onClick={()=>setMethod(m)}>{m}</button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
};

// ---------- Renew extra sub ----------
const RenewExtraSubModal = ({ student, extraSubId, onClose, notify }) => {
  const stored   = window.MK_STORE.getStudent(student.id);
  const esub     = (stored?.extraSubs || []).find(es => es.id === extraSubId);
  if (!esub) { onClose(); return null; }

  const _isoDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const _todayISO = _isoDate(new Date());
  const futureLessons = (esub.lessons || []).filter(l => l.status === 'future' || l.status === 'sick-wait');
  const hasFuture = futureLessons.length > 0;
  const _defaultStart = (() => {
    if (!hasFuture) return _todayISO;
    const last = futureLessons[futureLessons.length-1].date;
    const [dd, mm] = last.split('.');
    const d = new Date(`${new Date().getFullYear()}-${mm}-${dd}T00:00:00`);
    d.setDate(d.getDate() + 1);
    return _isoDate(d);
  })();

  const [packSize, setPackSize] = React.useState(esub.pack || 8);
  const [price, setPrice]       = React.useState(esub.price || 12800);
  const [startDate, setStart]   = React.useState(_defaultStart);
  const [payStatus, setPay]     = React.useState('paid');
  const [payMethod, setMethod]  = React.useState('СБП');

  const targetDays = (esub.days && esub.days.length) ? esub.days : [1,3,5];
  const generateLessons = (n, fromISO) => {
    const lessons = [];
    const d = new Date(fromISO + 'T00:00:00');
    let guard = 0;
    while (lessons.length < n && guard < 400) {
      if (targetDays.includes(d.getDay())) {
        const dd = String(d.getDate()).padStart(2,'0');
        const mm = String(d.getMonth()+1).padStart(2,'0');
        lessons.push({ date: `${dd}.${mm}`, status: 'future', note: '' });
      }
      d.setDate(d.getDate() + 1);
      guard++;
    }
    return lessons;
  };

  const lastDate = (() => { const ls = generateLessons(packSize, startDate); return ls.length ? ls[ls.length-1].date : '—'; })();

  const apply = () => {
    const todayHuman = new Date().toLocaleDateString('ru-RU');
    const noteSuffix = payStatus === 'paid'
      ? `Оплата · ${packSize} занятий — ${price.toLocaleString('ru-RU')} ₽ · ${payMethod}`
      : `Ждёт оплаты · ${packSize} занятий — ${price.toLocaleString('ru-RU')} ₽`;
    const newEvent = { type: payStatus === 'paid' ? 'payment' : 'payment-pending', date: todayHuman, note: noteSuffix };

    if (hasFuture) {
      window.MK_STORE.updateExtraSub(student.id, extraSubId, d => ({
        ...d, events: [...(d.events||[]), newEvent],
        queuedPack: { packSize, startDate, ...(payStatus==='paid'?{paid:todayHuman}:{}), events:[newEvent] },
      }));
      notify(payStatus==='paid' ? `Пакет в очереди · ${price.toLocaleString('ru-RU')} ₽ оплачено` : 'Пакет в очереди · ждём оплату', 'ok');
    } else {
      const oldDone = (esub.lessons||[]).filter(l=>l.status==='done'||l.status==='absent');
      window.MK_STORE.updateExtraSub(student.id, extraSubId, d => ({
        ...d,
        lessons: generateLessons(packSize, startDate),
        pack: packSize, price, used: 0, status: 'active',
        archivedLessons: [...(d.archivedLessons||[]), ...oldDone],
        ...(payStatus==='paid'?{paid:todayHuman}:{}),
        events: [...(d.events||[]), newEvent],
        queuedPack: null,
      }));
      notify(payStatus==='paid' ? `Пакет ${packSize} уроков · ${price.toLocaleString('ru-RU')} ₽ оплачено` : `Пакет ${packSize} уроков · ждём оплату`, 'ok');
    }
    onClose();
  };

  return (
    <Modal eyebrow={`${student.short} · ${esub.subject}`} title="Продлить" titleEm="пакет" onClose={onClose}
      foot={<>
        <button className="btn btn-sm" onClick={onClose}>Отмена</button>
        <button className="btn btn-sm btn-primary" onClick={apply}>
          <Icon name="check" size={13}/>
          {hasFuture ? (payStatus==='paid'?'В очередь и записать оплату':'В очередь (без оплаты)')
                     : (payStatus==='paid'?'Продлить и записать оплату':'Продлить (без оплаты)')}
        </button>
      </>}
    >
      {hasFuture && (
        <div style={{padding:'8px 12px',background:'var(--sky-pale)',border:'1px solid var(--sky)',borderRadius:8,fontSize:12,color:'var(--ink-soft)',marginBottom:4}}>
          Текущий пакет ещё идёт — новый встанет в очередь и стартует автоматически
        </div>
      )}
      <div className="fld">
        <label>Размер пакета</label>
        <div className="choices">
          {[4,6,8,12].map(n=>(
            <button key={n} className={`choice ${packSize===n?'on':''}`} onClick={()=>setPackSize(n)}>{n} уроков</button>
          ))}
        </div>
      </div>
      <div className="fld">
        <label>Стоимость пакета (₽)</label>
        <input type="number" value={price} onChange={e=>setPrice(+e.target.value)} min={0} step={100} />
      </div>
      <div className="fld">
        <label>{hasFuture ? 'Дата старта следующего пакета' : 'Дата активации (первый урок)'}</label>
        <input type="date" value={startDate} onChange={e=>setStart(e.target.value)} />
      </div>
      <div className="fld">
        <label>Оплата</label>
        <div className="choices">
          <button className={`choice ${payStatus==='paid'?'on':''}`} onClick={()=>setPay('paid')}>✓ Оплачено</button>
          <button className={`choice ${payStatus==='pending'?'on':''}`} onClick={()=>setPay('pending')}>⌛ Ждёт оплаты</button>
        </div>
      </div>
      {payStatus === 'paid' && (
        <div className="fld">
          <label>Способ оплаты</label>
          <div className="choices">
            {['СБП','Карта','Наличные'].map(m=>(
              <button key={m} className={`choice ${payMethod===m?'on':''}`} onClick={()=>setMethod(m)}>{m}</button>
            ))}
          </div>
        </div>
      )}
      <div className="kv-row">
        <div className="k">Текущий пакет</div>
        <div className="v">{esub.used} из {esub.pack} · осталось {esub.pack - esub.used}</div>
      </div>
      <div className="kv-row">
        <div className="k">Последний урок нового пакета</div>
        <div className="v">примерно {lastDate}</div>
      </div>
    </Modal>
  );
};

// ---------- Alert action ----------
const AlertModal = ({ alert, onClose, notify }) => {
  const stripHtml = (s) => s.replace(/<[^>]*>/g, '');
  return (
    <Modal
      eyebrow={alert.meta}
      title={alert.cta}
      onClose={onClose}
      foot={<>
        <button className="btn btn-sm" onClick={onClose}>Закрыть</button>
        <button className="btn btn-sm btn-primary" onClick={() => { onClose(); notify(`«${alert.cta}» — выполнено`, 'ok'); }}>
          <Icon name="check" size={13}/> {alert.cta}
        </button>
      </>}
    >
      <div className="font-serif italic" style={{fontSize: 18, lineHeight: 1.45, color: 'var(--ink)'}}>
        {stripHtml(alert.text)}
      </div>
      <div style={{marginTop: 14, fontFamily: 'JetBrains Mono', fontSize: 11, letterSpacing: '.1em', color: 'var(--ink-faint)'}}>
        {alert.meta}
      </div>
    </Modal>
  );
};

// ---------- Notifications panel ----------
const NotifSheet = ({ onClose, notify, goTo, setSelectedStudent }) => {
  const { openSheet } = useApp();
  const items = window.MK_ALERTS.items;
  // Сначала непрочитанные, потом прочитанные
  const sorted = [...items].sort((a, b) => (a.read === b.read) ? 0 : a.read ? 1 : -1);
  const unread = items.filter(i => !i.read).length;

  const handleOpen = (n) => {
    window.MK_ALERTS.markRead(n.id);
    if (n.target?.type === 'student' && n.target.id) {
      setSelectedStudent && setSelectedStudent(n.target.id);
      onClose();
      goTo && goTo('students');
      // Если у алерта есть action 'renew' — откроем модалку продления после перехода
      if (n.action === 'renew') {
        setTimeout(() => {
          const student = window.MK_STORE.getStudent(n.target.id);
          if (student) openSheet('renew', { student });
        }, 200);
      }
    } else {
      onClose();
    }
  };

  return (
    <Sheet
      eyebrow={items.length === 0 ? 'пока тихо' : `${items.length} событий · ${unread} непрочитано`}
      title="Оповещения"
      titleEm="и события"
      onClose={onClose}
      foot={<>
        <button className="btn btn-sm" disabled={unread === 0}
          style={{opacity: unread === 0 ? 0.5 : 1}}
          onClick={() => { window.MK_ALERTS.markAllRead(); notify('Все оповещения прочитаны', 'ok'); }}>
          Отметить всё прочитанным
        </button>
        <span className="grow"></span>
        <button className="btn btn-sm" onClick={onClose}>Готово</button>
      </>}
    >
      {sorted.length === 0 ? (
        <div className="font-serif italic" style={{fontSize:17, color:'var(--ink-soft)', padding:'10px 0'}}>
          Нет оповещений. Алерты появляются сами, когда у учеников заканчивается пакет, поступает оплата или есть незавершённая оплата.
        </div>
      ) : (
        <div className="notif-list">
          {sorted.map(n => (
            <div key={n.id} className="notif-row" style={{opacity: n.read ? 0.55 : 1}}>
              <span className={`dot ${n.kind === 'warn' ? 'warn' : n.kind === 'berry' ? 'berry' : ''}`}></span>
              <div>
                <div className="body" dangerouslySetInnerHTML={{ __html: n.body }} />
                <div className="when">{n.when}{n.read ? ' · прочитано' : ''}</div>
              </div>
              <button className="btn btn-sm btn-ghost" onClick={() => handleOpen(n)}>
                {n.cta || 'Открыть'}
              </button>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
};

// ---------- Global search ----------
const SearchSheet = ({ onClose, goTo, setSelectedStudent }) => {
  const { students, groups } = window.MK_DATA;
  const [q, setQ] = React.useState('');
  const inputRef = React.useRef(null);
  React.useEffect(() => { inputRef.current?.focus(); }, []);

  const Q = q.toLowerCase().trim();
  const studentHits = Q
    ? students.filter(s => s.name.toLowerCase().includes(Q) || s.group.toLowerCase().includes(Q)).slice(0, 6)
    : students.slice(0, 5);
  const groupHits = Q
    ? groups.filter(g => g.name.toLowerCase().includes(Q) || g.focus.toLowerCase().includes(Q)).slice(0, 4)
    : [];

  return (
    <Sheet
      eyebrow="поиск по ежедневнику"
      title="Найти"
      titleEm=""
      onClose={onClose}
    >
      <div className="fld">
        <input
          ref={inputRef}
          placeholder="ученик, группа, тема урока…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {studentHits.length > 0 && (
        <>
          <div className="eyebrow" style={{fontFamily:'JetBrains Mono', fontSize: 10.5, letterSpacing: '.16em', color: 'var(--ink-faint)', textTransform: 'uppercase', margin: '10px 0 8px'}}>
            Ученики
          </div>
          <div className="search-results">
            {studentHits.map(s => (
              <div key={s.id} className="search-row" onClick={() => { setSelectedStudent(s.id); goTo('students'); onClose(); }}>
                <div className="av" style={{color: s.spine}}>{Initials(s.name)}</div>
                <div style={{flex: 1}}>
                  <div className="what">{s.name}</div>
                  <div className="where">{s.group}{getAge(s) != null ? ` · ${getAge(s)} лет` : ''}</div>
                </div>
                <Icon name="arrow" size={14}/>
              </div>
            ))}
          </div>
        </>
      )}
      {groupHits.length > 0 && (
        <>
          <div className="eyebrow" style={{fontFamily:'JetBrains Mono', fontSize: 10.5, letterSpacing: '.16em', color: 'var(--ink-faint)', textTransform: 'uppercase', margin: '14px 0 8px'}}>
            Группы
          </div>
          <div className="search-results">
            {groupHits.map(g => (
              <div key={g.id} className="search-row" onClick={() => { goTo('groups'); onClose(); }}>
                <div className="av" style={{color: g.color}}>{g.name.slice(0,2).toUpperCase()}</div>
                <div style={{flex: 1}}>
                  <div className="what">{g.name}</div>
                  <div className="where">{g.age} · {g.focus}</div>
                </div>
                <Icon name="arrow" size={14}/>
              </div>
            ))}
          </div>
        </>
      )}
      {Q && studentHits.length === 0 && groupHits.length === 0 && (
        <div className="search-empty">ничего не нашлось по «{q}»</div>
      )}
    </Sheet>
  );
};

// ---------- Schedule filter ----------
const FilterSheet = ({ value, onApply, onClose }) => {
  const { subjects, groups } = window.MK_DATA;
  const [subs, setSubs] = React.useState(value.subjects || []);
  const [grps, setGrps] = React.useState(value.groups || []);
  const [showCanceled, setShowCanceled] = React.useState(value.showCanceled ?? true);

  const toggle = (arr, setArr, v) =>
    setArr(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  return (
    <Sheet
      eyebrow="вид расписания"
      title="Фильтр"
      titleEm=""
      onClose={onClose}
      foot={<>
        <button className="btn btn-sm" onClick={() => { setSubs([]); setGrps([]); setShowCanceled(true); }}>Сбросить</button>
        <span className="grow"></span>
        <button className="btn btn-sm btn-primary" onClick={() => { onApply({ subjects: subs, groups: grps, showCanceled }); onClose(); }}>
          Применить
        </button>
      </>}
    >
      <div className="fld">
        <label>Предметы</label>
        <div className="choices">
          {subjects.map(sb => (
            <button key={sb} className={`choice ${subs.includes(sb) ? 'on' : ''}`} onClick={() => toggle(subs, setSubs, sb)}>{sb}</button>
          ))}
        </div>
      </div>
      <div className="fld">
        <label>Группы</label>
        <div className="choices">
          {groups.map(g => (
            <button key={g.id} className={`choice ${grps.includes(g.id) ? 'on' : ''}`} onClick={() => toggle(grps, setGrps, g.id)}>{g.name}</button>
          ))}
        </div>
      </div>
      <div className="fld">
        <label>Прочее</label>
        <div className="choices">
          <button className={`choice ${showCanceled ? 'on' : ''}`} onClick={() => setShowCanceled(!showCanceled)}>
            Показывать перенесённые
          </button>
        </div>
      </div>
    </Sheet>
  );
};

// Вычисляет полных лет из строки «ДД.ММ.ГГГГ»
const calcAge = (birthDate) => {
  if (!birthDate) return null;
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(birthDate);
  if (!m) return null;
  const now = new Date();
  const born = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
  let age = now.getFullYear() - born.getFullYear();
  if (now < new Date(now.getFullYear(), parseInt(m[2]) - 1, parseInt(m[1]))) age--;
  return age >= 0 ? age : null;
};
// Возраст ученика: из birthDate или из числового поля age
const getAge = (s) => (s && s.birthDate) ? calcAge(s.birthDate) : (s && s.age != null ? s.age : null);

// ---------- New Student form ----------
const STUDENT_COLORS = ['#1F3A2E','#9B6B2F','#7A4A2E','#3E5F4B','#2C5F77','#5A4B7C','#8C4A4A','#6B6024','#4A6B3E','#7C5A2E','#3D4F7A','#5E3D6B'];

const StudentNewSheet = ({ onClose, notify, onCreated }) => {
  const groups = window.MK_STORE.groups;
  const [name, setName] = React.useState('');
  const [birthDate, setBirthDate] = React.useState('');
  const [parent, setParent] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [groupId, setGroupId] = React.useState('');
  const [spine, setSpine] = React.useState(STUDENT_COLORS[Math.floor(Math.random() * STUDENT_COLORS.length)]);

  const _deriveShort = (full) => {
    const parts = full.trim().split(/\s+/);
    if (parts.length === 0 || !parts[0]) return '';
    if (parts.length === 1) return parts[0];
    return parts[0] + ' ' + parts[1][0] + '.';
  };

  const save = () => {
    if (!name.trim()) { notify('Введите имя ученика', 'err'); return; }
    const id = `s_${Date.now().toString(36)}`;
    const monthsRu = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
    const now = new Date();
    const joined = `${monthsRu[now.getMonth()]} ${now.getFullYear()}`;
    const group = groups.find(g => g.id === groupId);
    const days = group?.days || [];
    const time = group?.time || '';
    const student = {
      id,
      name: name.trim(),
      short: _deriveShort(name),
      birthDate: birthDate.trim(),
      groupId: groupId || '',
      pack: 0,
      used: 0,
      parent: parent.trim() || '',
      phone: phone.trim() || '',
      joined,
      spine,
      scores: { 'Чтение': 50, 'Математика': 50, 'Письмо': 50, 'Логика': 50 },
      notes: '',
      notesList: [],
      days,
      time,
      price: window.MK_PROFILE.data.defaultPrice || 1600,
      paid: '',
      freezeUsed: 0, freezeMax: 3,
      status: 'active',
      lessons: [],
      events: [],
    };
    window.MK_STORE.addStudent(student);
    onCreated && onCreated(id);
    onClose();
    notify(`Ученик «${student.name}» добавлен`, 'ok');
  };

  return (
    <Sheet
      eyebrow="новая запись · ежедневник"
      title="Новый"
      titleEm="ученик"
      onClose={onClose}
      foot={<>
        <button className="btn btn-sm" onClick={onClose}>Отмена</button>
        <span className="grow"></span>
        <button className="btn btn-sm btn-primary" onClick={save}>
          <Icon name="check" size={13}/> Добавить
        </button>
      </>}
    >
      <div className="fld">
        <label>Имя и фамилия</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Лиза Морозова" autoFocus />
      </div>
      <div className="fld-row">
        <div className="fld">
          <label>Дата рождения</label>
          <input value={birthDate} onChange={e => setBirthDate(e.target.value)} placeholder="ДД.ММ.ГГГГ" maxLength={10} />
        </div>
        <div className="fld">
          <label>Группа</label>
          <select value={groupId} onChange={e => setGroupId(e.target.value)}>
            <option value="">без группы (индивид.)</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      </div>
      <div className="fld">
        <label>Родитель</label>
        <input value={parent} onChange={e => setParent(e.target.value)} placeholder="Имя и фамилия родителя" />
      </div>
      <div className="fld">
        <label>Телефон</label>
        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 999 123 45 67" />
      </div>
      <div className="fld">
        <label>Цвет (для аватарки и корешка)</label>
        <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
          {STUDENT_COLORS.map(c => (
            <button
              key={c}
              onClick={() => setSpine(c)}
              title={c}
              style={{
                width:24, height:24, padding:0, borderRadius:'50%', cursor:'pointer',
                background: c, border: spine === c ? '2px solid var(--ink)' : '2px solid transparent',
                outline: spine === c ? '2px solid var(--paper-card)' : 'none',
                outlineOffset: spine === c ? '-4px' : 0,
              }}
            />
          ))}
        </div>
      </div>
      <div style={{padding:'12px 14px', background:'var(--paper-deep)', borderRadius:8, fontSize:12, color:'var(--ink-soft)', marginTop:8}}>
        Пакет занятий — пустой. После создания откройте карточку и нажмите <b>Продлить пакет</b>, чтобы записать первую оплату.
      </div>
    </Sheet>
  );
};

// ---------- Group detail / edit / new ----------
const GROUP_COLORS = ['#3E5F4B','#9B6B2F','#2C5F77','#8C4A4A','#5A4B7C','#6B6024','#7A4A2E','#1F3A2E'];
const GROUP_WEEKDAYS = [
  {k:'пн', label:'Пн'},{k:'вт', label:'Вт'},{k:'ср', label:'Ср'},
  {k:'чт', label:'Чт'},{k:'пт', label:'Пт'},{k:'сб', label:'Сб'},{k:'вс', label:'Вс'},
];

// Парсер строк "Пн 09:00" → {day:'пн', time:'09:00'}
const _parseScheduleSlot = (s) => {
  const m = String(s).toLowerCase().match(/(вс|пн|вт|ср|чт|пт|сб)\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return { day: m[1], time: `${m[2].padStart(2,'0')}:${m[3]}` };
};
const _formatScheduleSlot = (slot) => {
  const cap = { пн:'Пн', вт:'Вт', ср:'Ср', чт:'Чт', пт:'Пт', сб:'Сб', вс:'Вс' };
  return `${cap[slot.day] || slot.day} ${slot.time}`;
};

const GroupSheet = ({ group, mode, onClose, notify, goTo, setSelectedStudent }) => {
  const { students } = window.MK_DATA;
  const { openSheet } = useApp();
  const [name, setName] = React.useState(group?.name || '');
  const [age, setAge] = React.useState(group?.age || '5–7 лет');
  const [focus, setFocus] = React.useState(group?.focus || '');
  const [room, setRoom] = React.useState(group?.room || 'Кабинет А');
  const [tag, setTag] = React.useState(group?.tag || '');
  const [color, setColor] = React.useState(group?.color || GROUP_COLORS[0]);
  // Слоты: [{day:'пн', time:'09:00'}, ...]
  const [slots, setSlots] = React.useState(() => {
    const parsed = (group?.schedule || []).map(_parseScheduleSlot).filter(Boolean);
    return parsed.length ? parsed : [];
  });
  // Состав: id учеников, которые в группе. В edit-режиме инит — текущие участники группы.
  const [members, setMembers] = React.useState(() => {
    if (!group) return new Set();
    return new Set(students.filter(s => s.groupId === group.id).map(s => s.id));
  });
  const [studentSearch, setStudentSearch] = React.useState('');

  const addSlot = () => setSlots(prev => [...prev, { day: 'пн', time: '09:00' }]);
  const removeSlot = (i) => setSlots(prev => prev.filter((_, idx) => idx !== i));
  const updateSlot = (i, patch) => setSlots(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));

  const toggleMember = (sid) => setMembers(prev => {
    const next = new Set(prev);
    if (next.has(sid)) next.delete(sid); else next.add(sid);
    return next;
  });

  if (mode === 'detail' && group) {
    const roster = students.filter(s => s.groupId === group.id);
    return (
      <Sheet
        eyebrow={`${group.tag} · ${group.age}`}
        title={group.name.split(' ')[0]}
        titleEm={group.name.split(' ').slice(1).join(' ')}
        onClose={onClose}
        foot={<>
          <button className="btn btn-sm" onClick={onClose}>Закрыть</button>
          <span className="grow"></span>
          <button className="btn btn-sm" onClick={() => {
            if (window.confirm(`Удалить группу «${group.name}»? Ученики останутся, но без группы.`)) {
              window.MK_STORE.removeGroup(group.id);
              onClose();
              notify(`Группа «${group.name}» удалена`, 'ok');
            }
          }} style={{color:'var(--berry)'}}>
            <Icon name="x" size={13}/> Удалить
          </button>
          <button className="btn btn-sm" onClick={() => { onClose(); openSheet('group', { mode: 'edit', group }); }}>
            <Icon name="edit" size={13}/> Редактировать
          </button>
        </>}
      >
        <div className="kv-row"><div className="k">Возраст</div><div className="v">{group.age}</div></div>
        <div className="kv-row"><div className="k">Программа</div><div className="v">{group.focus}</div></div>
        <div className="kv-row"><div className="k">Кабинет</div><div className="v">{group.room}</div></div>
        <div className="kv-row">
          <div className="k">Расписание</div>
          <div className="v" style={{display: 'flex', gap: 6, flexWrap: 'wrap'}}>
            {group.schedule.map((t, i) => <span key={i} className="time-chip">{t}</span>)}
          </div>
        </div>
        <div style={{marginTop: 18}}>
          <div className="eyebrow" style={{fontFamily:'JetBrains Mono', fontSize: 10.5, letterSpacing: '.16em', color: 'var(--ink-faint)', textTransform: 'uppercase', marginBottom: 10}}>
            Состав ({roster.length})
          </div>
          <div className="search-results">
            {roster.map(s => (
              <div key={s.id} className="search-row" onClick={() => { setSelectedStudent(s.id); goTo('students'); onClose(); }}>
                <div className="av" style={{color: s.spine}}>{Initials(s.name)}</div>
                <div style={{flex: 1}}>
                  <div className="what">{s.name}</div>
                  <div className="where">{getAge(s) != null ? `${getAge(s)} лет · ` : ''}пакет {s.pack - s.used}/{s.pack}</div>
                </div>
                <Icon name="arrow" size={14}/>
              </div>
            ))}
          </div>
        </div>
        {roster.length > 0 && (
          <div style={{
            marginTop:18, padding:'13px 15px', border:'1px dashed var(--rule)',
            borderRadius:10, color:'var(--ink-soft)', fontSize:12.5,
          }}>
            Проводка доступна из конкретного занятия в расписании, где известна точная дата.
          </div>
        )}
      </Sheet>
    );
  }

  // edit / new
  const apply = () => {
    if (!name.trim()) { notify('Укажите название группы', 'err'); return; }
    // Сортируем слоты: по дню недели (пн→вс), затем по времени
    const dayOrder = {'пн':1,'вт':2,'ср':3,'чт':4,'пт':5,'сб':6,'вс':7};
    const sortedSlots = [...slots].sort((a, b) => (dayOrder[a.day] - dayOrder[b.day]) || a.time.localeCompare(b.time));
    const schedule = sortedSlots.map(_formatScheduleSlot);
    const dayMap = {'вс':0,'пн':1,'вт':2,'ср':3,'чт':4,'пт':5,'сб':6};
    const days = [...new Set(sortedSlots.map(s => dayMap[s.day]))];
    const time = sortedSlots[0]?.time || '';
    const payload = {
      name: name.trim(), age, focus, room,
      tag: tag.trim() || '—',
      color,
      schedule,
      days,
      time,
      capacity: group?.capacity || 8,
    };
    let groupId;
    if (mode === 'new') {
      groupId = `g_${Date.now().toString(36)}`;
      window.MK_STORE.addGroup({ id: groupId, ...payload });
    } else {
      groupId = group.id;
      window.MK_STORE.updateGroup(group.id, payload);
    }
    // Применяем состав: каждый отмеченный → groupId этой группы;
    // каждый, кто был в этой группе, но снят с галочки → groupId стирается
    const wasInGroup = group ? new Set(students.filter(s => s.groupId === group.id).map(s => s.id)) : new Set();
    for (const s of students) {
      const shouldBe = members.has(s.id);
      const wasIn = wasInGroup.has(s.id);
      if (shouldBe && s.groupId !== groupId) {
        window.MK_STORE.updateStudent(s.id, { groupId });
      } else if (!shouldBe && wasIn) {
        window.MK_STORE.updateStudent(s.id, { groupId: '' });
      }
    }
    onClose();
    notify(
      mode === 'new'
        ? `Группа «${payload.name}» создана · ${members.size} ${members.size === 1 ? 'ученик' : 'учеников'}`
        : 'Изменения сохранены',
      'ok'
    );
  };

  return (
    <Sheet
      eyebrow={mode === 'new' ? 'новая запись' : 'правка'}
      title={mode === 'new' ? 'Новая' : 'Редактировать'}
      titleEm={mode === 'new' ? 'группа' : 'группу'}
      onClose={onClose}
      foot={<>
        <button className="btn btn-sm" onClick={onClose}>Отмена</button>
        <span className="grow"></span>
        <button className="btn btn-sm btn-primary" onClick={apply}>
          <Icon name="check" size={13}/> Сохранить
        </button>
      </>}
    >
      <div className="fld">
        <label>Название</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Утренние совята" />
      </div>
      <div className="fld-row">
        <div className="fld">
          <label>Возраст</label>
          <input value={age} onChange={e => setAge(e.target.value)} placeholder="5–6 лет" />
        </div>
        <div className="fld">
          <label>Кабинет</label>
          <select value={room} onChange={e => setRoom(e.target.value)}>
            <option>Кабинет А</option>
            <option>Кабинет Б</option>
            <option>Онлайн</option>
            <option>—</option>
          </select>
        </div>
      </div>
      <div className="fld">
        <label>Программа</label>
        <textarea value={focus} onChange={e => setFocus(e.target.value)} placeholder="Чтение по слогам, развитие речи…" />
      </div>
      <div className="fld-row">
        <div className="fld">
          <label>Метка (короткая)</label>
          <input value={tag} onChange={e => setTag(e.target.value)} placeholder="утро / 1:1 / eng" />
        </div>
        <div className="fld">
          <label>Цвет</label>
          <div style={{display:'flex', gap:6, flexWrap:'wrap', alignItems:'center'}}>
            {GROUP_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                title={c}
                style={{
                  width:24, height:24, padding:0, borderRadius:'50%', cursor:'pointer',
                  background:c, border: color === c ? '2px solid var(--ink)' : '2px solid transparent',
                  outline: color === c ? '2px solid var(--paper-card)' : 'none',
                  outlineOffset: color === c ? '-4px' : 0,
                }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="fld">
        <label>Расписание занятий</label>
        <div style={{display:'flex', flexDirection:'column', gap:8}}>
          {slots.length === 0 && (
            <div style={{fontSize:12.5, color:'var(--ink-faint)', fontStyle:'italic', padding:'8px 0'}}>
              Пока не задано · нажмите «+ Добавить день»
            </div>
          )}
          {slots.map((slot, i) => (
            <div key={i} style={{
              display:'flex', alignItems:'center', gap:8, padding:'8px 10px',
              background:'var(--paper-deep)', borderRadius:10, border:'1px solid var(--rule-soft)',
            }}>
              <div style={{display:'flex', gap:3, flex:1}}>
                {GROUP_WEEKDAYS.map(d => {
                  const on = slot.day === d.k;
                  return (
                    <button
                      key={d.k}
                      onClick={() => updateSlot(i, { day: d.k })}
                      style={{
                        flex:1, padding:'5px 0', borderRadius:6, cursor:'pointer',
                        border:'1px solid ' + (on ? color : 'var(--rule)'),
                        background: on ? color : 'var(--paper-card)',
                        color: on ? 'oklch(0.97 0.02 85)' : 'var(--ink-soft)',
                        fontFamily:'Manrope, sans-serif', fontSize:11, fontWeight: on ? 600 : 500,
                        transition:'all .12s',
                      }}
                    >{d.label}</button>
                  );
                })}
              </div>
              <input
                type="time"
                value={slot.time}
                onChange={e => updateSlot(i, { time: e.target.value })}
                style={{
                  width:90, padding:'6px 8px', border:'1px solid var(--rule)', borderRadius:6,
                  fontFamily:'JetBrains Mono', fontSize:12, background:'var(--paper-card)',
                  color:'var(--ink)', outline:'none',
                }}
              />
              <button
                onClick={() => removeSlot(i)}
                title="Удалить"
                style={{
                  width:28, height:28, padding:0, display:'grid', placeItems:'center', cursor:'pointer',
                  border:'1px solid var(--rule)', borderRadius:6, background:'var(--paper-card)',
                  color:'var(--ink-faint)',
                }}
                onMouseEnter={e => { e.currentTarget.style.color='var(--berry)'; e.currentTarget.style.borderColor='var(--berry)'; }}
                onMouseLeave={e => { e.currentTarget.style.color='var(--ink-faint)'; e.currentTarget.style.borderColor='var(--rule)'; }}
              ><Icon name="x" size={11}/></button>
            </div>
          ))}
          <button
            onClick={addSlot}
            style={{
              padding:'8px 12px', borderRadius:8, cursor:'pointer',
              border:'1.5px dashed var(--rule)', background:'transparent',
              color:'var(--ink-soft)', fontFamily:'Manrope', fontSize:12.5, fontWeight:500,
              display:'flex', alignItems:'center', gap:6, justifyContent:'center',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor=color; e.currentTarget.style.color=color; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='var(--rule)'; e.currentTarget.style.color='var(--ink-soft)'; }}
          ><Icon name="plus" size={12}/> Добавить день</button>
        </div>
      </div>

      <div className="fld">
        <label>Состав группы · выбрано {members.size}</label>
        <input
          value={studentSearch}
          onChange={e => setStudentSearch(e.target.value)}
          placeholder="Поиск ученика…"
          style={{marginBottom:8}}
        />
        <div style={{
          maxHeight:240, overflowY:'auto', border:'1px solid var(--rule)', borderRadius:8,
          background:'var(--paper-deep)',
        }}>
          {students
            .filter(s => !studentSearch || s.name.toLowerCase().includes(studentSearch.toLowerCase()))
            .map((s, i, arr) => {
              const checked = members.has(s.id);
              const curGroup = s.groupId && s.groupId !== group?.id ? window.MK_STORE.getGroupName(s.groupId) : '';
              return (
                <div
                  key={s.id}
                  onClick={() => toggleMember(s.id)}
                  style={{
                    display:'flex', alignItems:'center', gap:10, padding:'9px 12px',
                    borderBottom: i < arr.length - 1 ? '1px solid var(--rule-soft)' : 'none',
                    cursor:'pointer', background: checked ? 'var(--moss-pale)' : 'transparent',
                    transition:'background .12s',
                  }}
                  onMouseEnter={e => { if (!checked) e.currentTarget.style.background='var(--paper-card)'; }}
                  onMouseLeave={e => { if (!checked) e.currentTarget.style.background='transparent'; }}
                >
                  <div style={{
                    width:18, height:18, borderRadius:5, flexShrink:0,
                    border:'1.5px solid ' + (checked ? 'var(--forest)' : 'var(--rule)'),
                    background: checked ? 'var(--forest)' : 'var(--paper-card)',
                    display:'grid', placeItems:'center', color:'oklch(0.97 0.02 85)',
                  }}>
                    {checked && <Icon name="check" size={11}/>}
                  </div>
                  <div className="av" style={{color: s.spine, width:28, height:28, fontSize:11}}>{Initials(s.name)}</div>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:13, fontWeight:500, color:'var(--ink)'}}>{s.name}</div>
                    <div style={{fontSize:11, color:'var(--ink-faint)', fontFamily:'JetBrains Mono', letterSpacing:'.05em'}}>
                      {getAge(s) != null ? `${getAge(s)} лет` : ''}{curGroup ? `${getAge(s) != null ? ' · ' : ''}сейчас в ${curGroup}` : ''}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </Sheet>
  );
};

// ---------- Archive ----------
const ArchiveSheet = ({ onClose, notify, goTo, setSelectedStudent }) => {
  const students = window.MK_STORE.students;
  const _mruShort = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
  const _now = new Date();
  // Собираем все pre-этого-месяца платежи (это "закрытые" пакеты — раз уже прошёл месяц)
  // А также те, что у учеников status='ended'
  const items = [];
  for (const s of students) {
    for (const e of (s.events || [])) {
      if (e.type !== 'payment' && e.type !== 'payment-pending') continue;
      const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(e.date || '');
      if (!m) continue;
      const day = parseInt(m[1], 10);
      const month = parseInt(m[2], 10) - 1;
      const year = parseInt(m[3], 10);
      // Архив = всё что старше текущего месяца, либо ученик уже "ended"
      const isOlder = year < _now.getFullYear() || (year === _now.getFullYear() && month < _now.getMonth());
      const isEnded = s.status === 'ended';
      if (!isOlder && !isEnded) continue;
      const rub = (e.note || '').match(/([\d\s ]+)\s*₽/);
      const amount = rub ? parseInt(rub[1].replace(/[\s ]/g, ''), 10) : (s.price || 0);
      const lessonsMatch = (e.note || '').match(/(\d+)\s*заня/);
      const lessons = lessonsMatch ? lessonsMatch[1] : '';
      items.push({
        sid: s.id,
        spine: s.spine,
        who: s.name,
        day, month, year,
        sortKey: year * 10000 + month * 100 + day,
        what: `${lessons ? lessons + ' уроков · ' : ''}${amount.toLocaleString('ru-RU')} ₽`,
        status: e.type === 'payment-pending' ? 'ждёт' : (isEnded ? 'закрыт' : 'архив'),
      });
    }
  }
  items.sort((a, b) => b.sortKey - a.sortKey);

  return (
  <Sheet
    eyebrow="закрытые пакеты"
    title="Архив"
    titleEm="пакетов"
    onClose={onClose}
    foot={<button className="btn btn-sm" onClick={onClose}>Готово</button>}
  >
    <div style={{fontFamily:'JetBrains Mono', fontSize:10, letterSpacing:'.14em', textTransform:'uppercase', color:'var(--ink-faint)', marginBottom:14}}>
      {items.length === 0 ? 'архив пуст' : `${items.length} ${items.length === 1 ? 'запись' : items.length < 5 ? 'записи' : 'записей'}`}
    </div>
    {items.length === 0 ? (
      <div className="font-serif italic" style={{fontSize:16, color:'var(--ink-soft)'}}>
        Архив наполнится по мере того, как закрываются пакеты учеников или проходит месяц.
      </div>
    ) : (
      <div className="search-results">
        {items.map((r, i) => (
          <div
            key={i}
            className="search-row"
            onClick={() => { setSelectedStudent && setSelectedStudent(r.sid); goTo && goTo('students'); onClose(); }}
            style={{cursor:'pointer'}}
          >
            <div className="av" style={{color: r.spine}}>{r.who.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()}</div>
            <div style={{flex: 1}}>
              <div className="what">{r.who}</div>
              <div className="where">{String(r.day).padStart(2,'0')} {_mruShort[r.month]} {r.year} · {r.what}</div>
            </div>
            <span className="pill">{r.status}</span>
          </div>
        ))}
      </div>
    )}
  </Sheet>
  );
};

// ---------- Settings ----------
const SettingsSheet = ({ onClose, notify }) => {
  const profile = window.MK_PROFILE.data;
  const [name, setName] = React.useState(profile.name || '');
  const [role, setRole] = React.useState(profile.role || '');
  const [timezone, setTimezone] = React.useState(profile.timezone || '');
  const [defaultPrice, setDefaultPrice] = React.useState(profile.defaultPrice || 1600);
  const [paymentUrl, setPaymentUrl] = React.useState(profile.paymentUrl || '');
  const fileInputRef = React.useRef(null);
  const [backupBusy, setBackupBusy] = React.useState(false);

  const save = () => {
    window.MK_PROFILE.update({
      name: name.trim() || 'Учитель',
      role: role.trim() || 'педагог',
      timezone: timezone.trim(),
      defaultPrice: parseInt(defaultPrice, 10) || 1600,
      paymentUrl: paymentUrl.trim(),
    });
    notify('Настройки сохранены', 'ok');
    onClose();
  };

  const exportBackup = () => {
    try {
      const backup = createBackupDocument(
        window.MK_DOCUMENT_REPOSITORY.getSnapshot(),
      );
      const blob = new Blob(
        [JSON.stringify(backup, null, 2)],
        { type: 'application/json' },
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = createBackupFilename();
      anchor.click();
      URL.revokeObjectURL(url);
      notify('Резервная копия скачана', 'ok');
    } catch (error) {
      notify(error.message || 'Не удалось создать резервную копию', 'err');
    }
  };

  const importBackup = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBackupBusy(true);
    try {
      const parsed = parseBackupDocument(await file.text());
      const exportedLabel = parsed.exportedAt
        ? new Date(parsed.exportedAt).toLocaleString('ru-RU')
        : 'дата неизвестна';
      const confirmed = window.confirm(
        `Заменить текущие данные резервной копией?\n\n` +
        `Ученики: ${parsed.studentsCount}\n` +
        `Группы: ${parsed.groupsCount}\n` +
        `Создана: ${exportedLabel}\n\n` +
        `Перед импортом рекомендуется скачать текущую копию.`,
      );
      if (!confirmed) return;
      window.MK_STORE.replaceDocument(parsed.data);
      notify('Резервная копия восстановлена', 'ok');
      onClose();
    } catch (error) {
      notify(error.message || 'Не удалось прочитать резервную копию', 'err');
    } finally {
      setBackupBusy(false);
    }
  };

  return (
    <Sheet
      eyebrow="ежедневник"
      title="Настройки"
      onClose={onClose}
      foot={<>
        <button className="btn btn-sm" onClick={onClose}>Отмена</button>
        <span className="grow"></span>
        <button className="btn btn-sm btn-primary" onClick={save}>
          <Icon name="check" size={13}/> Сохранить
        </button>
      </>}
    >
      <div className="fld">
        <label>Имя</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Имя и фамилия" />
      </div>
      <div className="fld">
        <label>Роль / должность</label>
        <input value={role} onChange={e => setRole(e.target.value)} placeholder="репетитор / педагог" />
      </div>
      <div className="fld">
        <label>Часовой пояс</label>
        <input value={timezone} onChange={e => setTimezone(e.target.value)} placeholder="Москва · GMT+3" />
      </div>
      <div className="fld">
        <label>Стоимость урока по умолчанию</label>
        <input type="number" value={defaultPrice} onChange={e => setDefaultPrice(e.target.value)} placeholder="1600" />
        <div style={{fontSize:11, color:'var(--ink-faint)', marginTop:4}}>Используется когда у ученика не указана своя цена.</div>
      </div>
      <div className="fld">
        <label>Ссылка для оплаты (СБП / QR)</label>
        <input value={paymentUrl} onChange={e => setPaymentUrl(e.target.value)} placeholder="https://qr.nspk.ru/..." />
        <div style={{fontSize:11, color:'var(--ink-faint)', marginTop:4}}>Будет показана родителям в карточке ученика.</div>
      </div>
      <section className="backup-panel">
        <div className="backup-kicker">Данные и безопасность</div>
        <div className="backup-title">Резервная копия</div>
        <p>
          Скачайте всю базу учеников, групп и абонементов одним JSON-файлом.
        </p>
        <div className="backup-actions">
          <button className="btn btn-sm" type="button" onClick={exportBackup}>
            <Icon name="download" size={13}/> Скачать
          </button>
          <button
            className="btn btn-sm"
            type="button"
            disabled={backupBusy}
            onClick={() => fileInputRef.current?.click()}
          >
            <Icon name="archive" size={13}/>
            {backupBusy ? 'Проверяю…' : 'Восстановить'}
          </button>
          <input
            ref={fileInputRef}
            className="backup-file-input"
            type="file"
            accept="application/json,.json"
            onChange={importBackup}
          />
        </div>
        <div className="backup-sync">
          <span className={`sync-dot ${
            window.MK_SYNC_STATUS.value.state === 'connected' ? 'is-ok' : ''
          }`}></span>
          {window.MK_SYNC_STATUS.value.savedAt
            ? `Последнее облачное сохранение: ${new Date(window.MK_SYNC_STATUS.value.savedAt).toLocaleString('ru-RU')}`
            : 'Ожидаем первое облачное сохранение'}
        </div>
      </section>
    </Sheet>
  );
};

// ---------- Attendance mark picker ----------
const MarkPicker = ({ onPick, onClose }) => {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const onClick = (e) => { if (!e.target.closest('.popover')) onClose(); };
    document.addEventListener('keydown', onKey);
    setTimeout(() => document.addEventListener('click', onClick), 0);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('click', onClick); };
  }, [onClose]);

  return (
    <div className="popover" style={{
      position: 'absolute', zIndex: 80,
      background: 'var(--paper)', border: '1px solid var(--rule)',
      borderRadius: 10, boxShadow: 'var(--shadow-card)',
      transform: 'translateY(6px)',
    }}>
      <div className="mark-picker">
        {[
          { v: 'P', cls: 'present', label: '✓' },
          { v: 'L', cls: 'late',    label: '⌖' },
          { v: 'A', cls: 'absent',  label: '✗' },
          { v: 'M', cls: 'makeup',  label: 'м' },
          { v: '-', cls: 'skip',    label: '·' },
        ].map(m => (
          <button key={m.v} className={`mark-pick ${m.cls}`} onClick={() => { onPick(m.v); onClose(); }}>
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// expose globals
Object.assign(window, {
  AppCtx, AppProvider, useApp,
  Sheet, Modal,
  RecordLessonSheet, LessonDetailSheet, ContactSheet,
  RenewModal, RenewExtraSubModal, AddExtraSubModal, AddIndividualLessonModal, ContactEditModal, AlertModal, NotifSheet, SearchSheet,
  FilterSheet, GroupSheet, ArchiveSheet, SettingsSheet,
  MarkPicker,
});

// ---- Legacy section 5 ----
// Dashboard
const Dashboard = ({ goTo }) => {
  const { today, alerts, students, week } = window.MK_DATA;
  const { openSheet, notify } = useApp();

  const _now = new Date();
  const _todayIdx = (_now.getDay() + 6) % 7;
  const _fmtTime = (h) => `${String(Math.floor(h)).padStart(2,'0')}:${String(Math.round((h % 1) * 60)).padStart(2,'0')}`;
  const _nowH = _now.getHours() + _now.getMinutes() / 60;
  const _groups = window.MK_STORE.groups;
  const _mruDash = ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
  const todaySchedule = window.MK_SCHEDULE.lessonsForDate(_now)
    .map(b => {
      let name, sub, topic = b.subject;
      if (b.group) {
        const g = _groups.find(g => g.id === b.groupId);
        const cnt = students.filter(s => s.groupId === b.groupId).length;
        name = (g?.name || 'Группа') + ' · группа';
        sub = `${cnt} ${cnt === 1 ? 'ученик' : cnt < 5 ? 'ученика' : 'учеников'}`;
      } else {
        const st = students.find(s => s.id === b.studentId);
        name = st?.name || '—';
        sub = (b.subject || '').toLowerCase();
      }
      let status;
      if (b.canceled) status = 'cancel';
      else if (_nowH > b.end) status = 'done';
      else if (_nowH >= b.start) status = 'now';
      else status = 'next';
      return {
        ...b,
        time: _fmtTime(b.start),
        dur: `${Math.round((b.end - b.start) * 60)} МИН`,
        name, sub, topic, status,
      };
    });

  const lowPack = students.filter(s => (s.pack - s.used) <= 1);
  const totalActive = students.filter(s => (s.pack - s.used) > 0).length;

  // Поступления за текущий месяц — суммируем по платёжным событиям студентов
  const sumPayments = (targetMonth, targetYear) => {
    let sum = 0, count = 0;
    for (const s of students) {
      for (const e of (s.events || [])) {
        if (e.type !== 'payment') continue;
        const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(e.date || '');
        if (!m) continue;
        const month = parseInt(m[2], 10) - 1;
        const year = parseInt(m[3], 10);
        if (month !== targetMonth || year !== targetYear) continue;
        const rub = (e.note || '').match(/([\d\s ]+)\s*₽/);
        if (rub) sum += parseInt(rub[1].replace(/[\s ]/g, ''), 10) || 0;
        else sum += s.price || 0;
        count++;
      }
    }
    return { sum, count };
  };
  const _curMonth = _now.getMonth();
  const _curYear = _now.getFullYear();
  const _prevMonth = _curMonth === 0 ? 11 : _curMonth - 1;
  const _prevYear = _curMonth === 0 ? _curYear - 1 : _curYear;
  const _curPayments = sumPayments(_curMonth, _curYear);
  const _prevPayments = sumPayments(_prevMonth, _prevYear);
  const _incomeDelta = _prevPayments.sum > 0
    ? Math.round((_curPayments.sum - _prevPayments.sum) / _prevPayments.sum * 100)
    : null;
  const _closingsSoon = (() => {
    const horizon = 3;
    let cnt = 0;
    for (const s of students) {
      const remaining = (s.pack || 0) - (s.used || 0);
      if (remaining <= 0 || remaining > 5) continue;
      const studentDays = s.days || [];
      let lessonsInHorizon = 0;
      const d = new Date(_now);
      for (let i = 0; i <= horizon; i++) {
        if (studentDays.includes(d.getDay())) lessonsInHorizon++;
        d.setDate(d.getDate() + 1);
      }
      if (lessonsInHorizon >= remaining) cnt++;
    }
    return cnt;
  })();
  const _ruMonthsList = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
  const _newThisMonth = students.filter(s => {
    if (!s.joined) return false;
    const j = s.joined.toLowerCase();
    return j.includes(_ruMonthsList[_curMonth]) && j.includes(String(_curYear));
  }).length;
  const _waitlist = 0; // нет данных о листе ожидания

  const monthIncome = _curPayments.sum;

  // Алерты из MK_ALERTS (только непрочитанные, до 4)
  const dashAlerts = window.MK_ALERTS.items.filter(a => !a.read).slice(0, 4);
  // Наблюдения недели — авто-генерация
  const observations = window.MK_OBSERVATIONS.items;

  return (
    <div className="content">
      <div className="dash-2col">
        {/* HERO TODAY */}
        <div className="today-hero">
          <div className="corner-stamp">{today.date}</div>
          <div className="eyebrow">Сегодня · ваш день</div>
          <div className="date">
            {today.weekday}, <em>{today.date}</em> {today.month}
          </div>
          <div className="weekday">{String(_now.getDate()).padStart(2,'0')} · {String(_now.getMonth()+1).padStart(2,'0')} · {_now.getFullYear()}  ·  неделя {(() => { const u=new Date(Date.UTC(_now.getFullYear(),_now.getMonth(),_now.getDate())); const dn=u.getUTCDay()||7; u.setUTCDate(u.getUTCDate()+4-dn); const y=new Date(Date.UTC(u.getUTCFullYear(),0,1)); return Math.ceil((((u-y)/86400000)+1)/7); })()}</div>

          <div className="summary">
            <div><span className="n">{todaySchedule.filter(t => !t.canceled).length}</span><span className="l">уроков</span></div>
            <div><span className="n">{new Set(todaySchedule.filter(t => !t.canceled).map(t => t.group ? `g:${t.groupId}` : `s:${t.studentId}`)).size}</span><span className="l">записей</span></div>
            <div><span className="n">{todaySchedule.filter(t => !t.canceled).reduce((acc, t) => acc + (t.end - t.start), 0).toFixed(1)}<small> ч</small></span><span className="l">в работе</span></div>
            <div><span className="n">{todaySchedule.filter(t => t.canceled).length}</span><span className="l">переносов</span></div>
          </div>

          <div className="weekstrip">
            {today.week.map((wd, i) => (
              <div
                key={wd}
                className={`weekstrip-day ${i === today.todayIdx ? 'today' : ''}`}
                onClick={() => goTo('schedule')}
                style={{cursor: 'pointer'}}
              >
                {wd}<span className="num">{today.weekNums[i]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* TODAY LESSONS LIST */}
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-tag">расписание дня</div>
              <div className="card-title">Сегодня <em>в работе</em></div>
            </div>
            <button className="btn btn-sm btn-ghost" onClick={() => goTo('schedule')}>
              Вся неделя <Icon name="arrow" size={14}/>
            </button>
          </div>
          <div className="today-list">
            {todaySchedule.map((r, i) => (
              <div key={i} className="lesson-row" onClick={() => openSheet('lesson', { lesson: { ...r, dayName: 'Сегодня' } })}>
                <div className="lesson-time">{r.time}<span className="dur">{r.dur}</span></div>
                <div>
                  <div className="lesson-meta-line">
                    <span className="lesson-name">{r.name}</span>
                    <span className="lesson-sub">/ {r.sub}</span>
                  </div>
                  <div className="lesson-topic">{r.topic}</div>
                </div>
                <span className={`lesson-status ${r.status === 'now' ? '' : r.status === 'next' ? 'next' : 'done'}`}>
                  {r.status === 'done' ? '✓ проведён' : r.status === 'now' ? '● идёт' : r.status === 'next' ? 'следующий' : '⏵ перенос'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* STATS ROW */}
      <div className="dash-grid">
        <div className="stat" onClick={() => goTo('students')} style={{cursor:'pointer'}}>
          <div className="ornament"><Icon name="students" size={14}/></div>
          <div className="stat-label">Учеников активно</div>
          <div className="stat-num">{totalActive}<small>/ {students.length}</small></div>
          <div className="stat-foot">
            {_newThisMonth > 0
              ? <><span className="delta-up">+{_newThisMonth}</span> за этот месяц</>
              : 'без новых за этот месяц'}
          </div>
        </div>
        <div className="stat" onClick={() => goTo('schedule')} style={{cursor:'pointer'}}>
          <div className="ornament"><Icon name="cal" size={14}/></div>
          <div className="stat-label">Уроков в неделю</div>
          <div className="stat-num">{week.filter(b => !b.canceled).length}</div>
          <div className="stat-foot">по расписанию</div>
        </div>
        <div className="stat" onClick={() => openSheet('payments-report')} style={{cursor:'pointer'}}>
          <div className="ornament"><Icon name="sparkle" size={14}/></div>
          <div className="stat-label">Поступления, {_mruDash[_now.getMonth()]}</div>
          <div className="stat-num font-serif">{monthIncome >= 1000 ? `${(monthIncome/1000).toFixed(1)}` : monthIncome}<small> {monthIncome >= 1000 ? 'т ' : ''}₽</small></div>
          <div className="stat-foot">
            {_incomeDelta !== null && (
              <><span className={_incomeDelta >= 0 ? 'delta-up' : 'delta-down'}>
                {_incomeDelta >= 0 ? '+' : ''}{_incomeDelta}%
              </span> к {_mruDash[_prevMonth]} · </>
            )}
            {_curPayments.count} {_curPayments.count === 1 ? 'пакет оплачен' : _curPayments.count < 5 ? 'пакета оплачено' : 'пакетов оплачено'}
          </div>
        </div>
        <div className="stat" onClick={() => goTo('students')} style={{cursor:'pointer'}}>
          <div className="ornament"><Icon name="bell" size={14}/></div>
          <div className="stat-label">Пакеты к продлению</div>
          <div className="stat-num">{lowPack.length}</div>
          <div className="stat-foot">
            {_closingsSoon > 0
              ? <><span className="delta-down">{_closingsSoon} {_closingsSoon === 1 ? 'закрытие' : _closingsSoon < 5 ? 'закрытия' : 'закрытий'}</span> в ближайшие 3 дня</>
              : 'на ближайшие 3 дня всё ок'}
          </div>
        </div>
      </div>

      {/* TWO COLUMN: ALERTS + OBSERVATIONS */}
      <div className="dash-2col">
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-tag">требует внимания</div>
              <div className="card-title">Оповещения <em>и события</em></div>
            </div>
            {dashAlerts.length > 0 && <Pill tone="berry" dot>{dashAlerts.length} новых</Pill>}
          </div>
          <div className="alerts">
            {dashAlerts.length === 0 ? (
              <div className="font-serif italic" style={{fontSize:15, color:'var(--ink-faint)', padding:'10px 4px'}}>
                Сейчас нет открытых вопросов — все алерты прочитаны.
              </div>
            ) : dashAlerts.map(a => (
              <div key={a.id} className="alert-row">
                <div className={`alert-dot ${a.kind === 'warn' ? 'warn' : a.kind === 'berry' ? 'berry' : ''}`}></div>
                <div className="alert-text">
                  <span dangerouslySetInnerHTML={{ __html: a.body }} />
                  <span className="meta">{a.when}</span>
                </div>
                <button className="alert-act" onClick={() => {
                  window.MK_ALERTS.markRead(a.id);
                  if (a.target?.type === 'student' && a.target.id) {
                    setSelectedStudent && setSelectedStudent(a.target.id);
                    goTo && goTo('students');
                    if (a.action === 'renew') {
                      setTimeout(() => {
                        const st = window.MK_STORE.getStudent(a.target.id);
                        if (st) openSheet('renew', { student: st });
                      }, 200);
                    }
                  }
                }}>{a.cta || 'Открыть'}</button>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-tag">наблюдения недели</div>
              <div className="card-title">Что я <em>заметила</em></div>
            </div>
          </div>

          {observations.length === 0 ? (
            <div className="font-serif italic" style={{fontSize:15, color:'var(--ink-faint)', padding:'10px 4px'}}>
              Пока всё ровно — наблюдения появятся когда у учеников будут заметные изменения (много проведённых уроков подряд, пропуски, пакет на исходе).
            </div>
          ) : (
            <div style={{display:'flex', flexDirection:'column', gap:18}}>
              {observations.map((obs, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <div className="divider"></div>}
                  <div>
                    <div style={{display:'flex', alignItems:'baseline', gap:8, marginBottom: 6}}>
                      <span className="font-serif" style={{fontSize:22, color: obs.color}}>{obs.icon} {obs.name}</span>
                      <span style={{fontSize:12, color:'var(--ink-faint)'}}>{obs.hint}</span>
                    </div>
                    <div className="font-serif italic" style={{fontSize:15, color:'var(--ink-soft)'}}>
                      {obs.text}
                    </div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

window.Dashboard = Dashboard;

// ---- Legacy section 6 ----
// Students list + profile

// ---- Persistent per-student skills («Готовность» блок) ----
const LS_SKILLS = 'mk.skills';
const LS_HIDDEN = 'mk.skills.hidden';
const loadJSON = (key, fallback) => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
};
const useSkillsStore = () => {
  const [map, setMap] = React.useState(() => loadJSON(LS_SKILLS, {}));
  const [hidden, setHidden] = React.useState(() => new Set(loadJSON(LS_HIDDEN, [])));

  const getSkills = (s) => {
    if (map[s.id]) return map[s.id];
    // first time — seed from data (placeholders)
    return Object.entries(s.scores).map(([name, value]) => ({ name, value }));
  };
  const isHidden = (id) => hidden.has(id);

  const writeSkills = (sid, skills) => {
    const next = { ...map, [sid]: skills.map(({ name, value }) => ({ name, value })) };
    setMap(next);
    try { localStorage.setItem(LS_SKILLS, JSON.stringify(next)); } catch {}
  };
  const setHide = (sid, v) => {
    const next = new Set(hidden);
    if (v) next.add(sid); else next.delete(sid);
    setHidden(next);
    try { localStorage.setItem(LS_HIDDEN, JSON.stringify([...next])); } catch {}
  };
  return { getSkills, isHidden, writeSkills, setHide };
};

const Students = ({ selectedId, setSelectedId }) => {
  const [students, setStudents] = React.useState(() => window.MK_STORE.students);
  const [q, setQ] = React.useState('');
  const [groupFilter, setGroupFilter] = React.useState('all');
  const [filterOpen, setFilterOpen] = React.useState(false);
  const { openSheet, notify } = useApp();
  const skillsStore = useSkillsStore();
  const groups = window.MK_STORE.groups;
  const dropdownRef = React.useRef(null);

  // Re-sync from store when students change
  React.useEffect(() => window.MK_STORE.subscribe(() => setStudents([...window.MK_STORE.students])), []);

  // Close dropdown on outside click / Escape
  React.useEffect(() => {
    if (!filterOpen) return;
    const onClick = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setFilterOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setFilterOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, [filterOpen]);

  const filtered = students.filter(s => {
    if (groupFilter !== 'all' && s.groupId !== groupFilter) return false;
    const gname = window.MK_STORE.getGroupName(s.groupId) || '';
    return s.name.toLowerCase().includes(q.toLowerCase()) || gname.toLowerCase().includes(q.toLowerCase());
  });
  const sel = students.find(s => s.id === selectedId) || students[0];

  const activeGroup = groups.find(g => g.id === groupFilter);
  const activeColor = activeGroup ? activeGroup.color : 'var(--ink-faint)';
  const activeName = activeGroup ? activeGroup.name : 'Все группы';

  const _itemBase = {
    display:'flex', alignItems:'center', gap:10, padding:'9px 12px',
    cursor:'pointer', fontFamily:'Manrope, sans-serif', fontSize:13,
    color:'var(--ink-soft)', borderBottom:'1px solid var(--rule-soft)',
    transition:'background .12s',
  };

  return (
    <div className="content">
      <div className="students-shell">
        {/* LIST */}
        <div className="card students-list-card">
          <div style={{padding:'10px 14px 0', display:'flex', gap:6}}>
            <button
              onClick={() => openSheet('student-new', { onCreated: (id) => setSelectedId(id) })}
              className="btn btn-sm btn-primary"
              style={{width:'100%', justifyContent:'center'}}
            >
              <Icon name="plus" size={13}/> Новый ученик
            </button>
          </div>
          <div className="students-search">
            <Icon name="search" size={16} />
            <input
              placeholder="Найти ученика…"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
            <span className="count">{filtered.length} / {students.length}</span>
          </div>
          <div ref={dropdownRef} style={{position:'relative', padding:'8px 14px 12px', borderBottom:'1px dashed var(--rule)'}}>
            <button
              onClick={() => setFilterOpen(o => !o)}
              style={{
                width:'100%', padding:'7px 11px', borderRadius:8, cursor:'pointer',
                border:'1px solid ' + (filterOpen ? 'var(--forest)' : 'var(--rule)'),
                background: filterOpen ? 'var(--moss-pale)' : 'var(--paper-deep)',
                display:'flex', alignItems:'center', gap:9,
                fontFamily:'Manrope, sans-serif', fontSize:12.5,
                color:'var(--ink)', transition:'all .15s',
              }}
            >
              <span style={{
                width:10, height:10, borderRadius:'50%', background: activeColor,
                flexShrink:0, boxShadow: groupFilter === 'all' ? 'inset 0 0 0 1px var(--rule)' : 'none',
              }}/>
              <span style={{flex:1, textAlign:'left', fontWeight: 500}}>{activeName}</span>
              <span style={{
                fontFamily:'JetBrains Mono', fontSize:10, color:'var(--ink-faint)',
                letterSpacing:'.08em', padding:'1px 6px', background:'var(--paper-card)',
                borderRadius:4, border:'1px solid var(--rule-soft)',
              }}>
                {groupFilter === 'all' ? students.length : students.filter(s => s.groupId === groupFilter).length}
              </span>
              <span style={{color:'var(--ink-faint)', transform: filterOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition:'transform .15s'}}>
                <Icon name="chevron" size={11}/>
              </span>
            </button>

            {filterOpen && (
              <div style={{
                position:'absolute', top:'calc(100% - 6px)', left:14, right:14, zIndex:30,
                background:'var(--paper-card)', border:'1px solid var(--rule)', borderRadius:10,
                boxShadow:'0 8px 24px -6px rgba(0,0,0,.18)', overflow:'hidden',
                maxHeight: 320, overflowY: 'auto',
              }}>
                <div
                  onClick={() => { setGroupFilter('all'); setFilterOpen(false); }}
                  onMouseEnter={e => e.currentTarget.style.background='var(--paper-deep)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}
                  style={{..._itemBase, background: groupFilter === 'all' ? 'var(--moss-pale)' : 'transparent'}}
                >
                  <span style={{width:10, height:10, borderRadius:'50%', background:'var(--ink-faint)', boxShadow:'inset 0 0 0 1px var(--rule)', flexShrink:0}}/>
                  <span style={{flex:1, fontWeight: groupFilter === 'all' ? 600 : 500, color: groupFilter === 'all' ? 'var(--ink)' : 'var(--ink-soft)'}}>Все группы</span>
                  <span style={{fontFamily:'JetBrains Mono', fontSize:10, color:'var(--ink-faint)', letterSpacing:'.08em'}}>{students.length}</span>
                  {groupFilter === 'all' && <Icon name="check" size={13}/>}
                </div>
                {groups.map(g => {
                  const cnt = students.filter(s => s.groupId === g.id).length;
                  const on = groupFilter === g.id;
                  return (
                    <div
                      key={g.id}
                      onClick={() => { setGroupFilter(g.id); setFilterOpen(false); }}
                      onMouseEnter={e => e.currentTarget.style.background='var(--paper-deep)'}
                      onMouseLeave={e => e.currentTarget.style.background= on ? 'var(--moss-pale)' : 'transparent'}
                      style={{..._itemBase, background: on ? 'var(--moss-pale)' : 'transparent'}}
                      title={g.focus}
                    >
                      <span style={{width:10, height:10, borderRadius:'50%', background:g.color, flexShrink:0}}/>
                      <span style={{flex:1, minWidth:0, fontWeight: on ? 600 : 500, color: on ? 'var(--ink)' : 'var(--ink-soft)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{g.name}</span>
                      <span style={{fontFamily:'JetBrains Mono', fontSize:10, color:'var(--ink-faint)', letterSpacing:'.08em'}}>{cnt}</span>
                      {on && <Icon name="check" size={13}/>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="students-list">
            {filtered.map(s => {
              const profileSub = getProfileSubscriptionView(s.id, 'main');
              const left = profileSub?.left ?? (s.lessons||[]).filter(l=>l.status==='future'||l.status==='sick-wait').length;
              const total = profileSub?.totalSessions ?? s.pack ?? s.totalSessions ?? 8;
              const lowClass = left === 0 ? 'empty' : left <= 1 ? 'low' : '';
              const groupName = window.MK_STORE.getGroupName(s.groupId);
              return (
                <div
                  key={s.id}
                  className={`student-card ${sel && sel.id === s.id ? 'active' : ''}`}
                  style={{ '--bookspine': s.spine }}
                  onClick={() => setSelectedId(s.id)}
                >
                  <div className="spine" />
                  <div className="av" style={{ color: s.spine }}>{Initials(s.name)}</div>
                  <div>
                    <div className="student-name">{s.name}</div>
                    <div className="student-sub">{getAge(s) != null ? `${getAge(s)} ЛЕТ · ` : ''}{groupName}</div>
                  </div>
                  <div className="right">
                    <span className={`pack-pill ${lowClass}`}>
                      {left}/{total}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* PROFILE */}
        {sel ? (
          <StudentProfile
            student={sel}
            openSheet={openSheet}
            notify={notify}
            skillsStore={skillsStore}
            onStudentUpdate={() => setStudents([...window.MK_STORE.students])}
          />
        ) : (
          <section className="card students-empty">
            <div className="students-empty-mark" aria-hidden="true">
              <span>1</span>
              <i />
              <span>2</span>
              <i />
              <span>3</span>
            </div>
            <div className="students-empty-copy">
              <div className="eyebrow">Начало работы</div>
              <h2>Добавьте первого <em>ученика</em></h2>
              <p>
                Карточка объединит расписание, абонемент, посещаемость
                и заметки для родителей.
              </p>
              <button
                className="btn btn-primary"
                onClick={() => openSheet('student-new', { onCreated: (id) => setSelectedId(id) })}
              >
                <Icon name="plus" size={15}/> Добавить ученика
              </button>
            </div>
            <div className="students-empty-note">
              <span className="students-empty-note-num">01</span>
              <div>
                <strong>Тестовая группа уже готова</strong>
                <span>Её можно выбрать в форме ученика или изменить в разделе «Группы».</span>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

const StudentProfile = ({ student: s, openSheet, notify, skillsStore, onStudentUpdate }) => {
  const profileSub = getProfileSubscriptionView(s.id, 'main');
  const left = profileSub?.left ?? (s.lessons||[]).filter(l=>l.status==='future'||l.status==='sick-wait').length;
  const groupName = window.MK_STORE.getGroupName(s.groupId) || s.group || '—';
  const [tab, setTab] = React.useState('обзор');
  const [subjectId, setSubjectId] = React.useState('main');
  const extraSubs = (window.MK_STORE.getStudent(s.id) || s).extraSubs || [];

  React.useEffect(() => { setSubjectId('main'); }, [s.id]);

  return (
    <div className="profile card" style={{ '--bookspine': s.spine }}>
      <div className="profile-head">
        <div className="lib-tag">
          формуляр ученика<br/>
          <span className="num">№ {s.id.replace('s','').padStart(3,'0')}</span>
        </div>
        <div className="profile-top">
          <div className="profile-av">{Initials(s.name)}</div>
          <div>
            <div className="profile-name">
              {s.name.split(' ')[0]} <em>{s.name.split(' ')[1]}</em>
            </div>
            <div className="profile-meta">
              {getAge(s) != null ? `${getAge(s)} лет` : ''}{s.birthDate ? ` (${s.birthDate.slice(0,5)})` : ''}{(getAge(s) != null || s.birthDate) ? ' · ' : ''}группа <b>{groupName}</b> · с <b>{s.joined||'2024'}</b>
            </div>
          </div>
        </div>
      </div>

      {extraSubs.length > 0 && (
        <div className="profile-subject-tabs">
          <button className={`subject-tab ${subjectId === 'main' ? 'on' : ''}`} onClick={() => setSubjectId('main')}>Основное</button>
          {extraSubs.map(es => (
            <button key={es.id} className={`subject-tab ${subjectId === es.id ? 'on' : ''}`} onClick={() => setSubjectId(es.id)}>
              {es.subject || 'Доп.'}
            </button>
          ))}
        </div>
      )}

      <div className="profile-tabs">
        {['обзор', 'занятия', 'оплата', 'заметки'].map(tn => (
          <div key={tn} className={`tab ${tab === tn ? 'active' : ''}`} onClick={() => setTab(tn)}>
            {tn.charAt(0).toUpperCase() + tn.slice(1)}
          </div>
        ))}
        <div style={{marginLeft:'auto', display:'flex', gap:8, padding:'4px 0'}}>
          <button
            className="btn btn-sm"
            onClick={() => {
              if (!window.confirm(`Удалить ученика «${s.name}»? Все его уроки, платежи и заметки будут утеряны.`)) return;
              window.MK_STORE.removeStudent(s.id);
              notify(`Ученик «${s.name}» удалён`, 'ok');
            }}
            style={{color:'var(--berry)'}}
            title="Удалить ученика"
          >
            <Icon name="x" size={13}/> Удалить
          </button>
          <button className="btn btn-sm" onClick={() => openSheet('parent-mk', { student: s })}>
              <Icon name="share" size={13}/> Карточка для родителей
            </button>
          <button className="btn btn-sm btn-primary" onClick={() => openSheet('record', { initialStudentId: s.id })}><Icon name="plus" size={13}/> Записать урок</button>
        </div>
      </div>

      <div className="profile-body">
        {tab === 'обзор'   && <OverviewPane key={s.id} s={s} left={left} openSheet={openSheet} notify={notify} skillsStore={skillsStore} activeSubId={subjectId} />}
        {tab === 'занятия' && <LessonsPane key={s.id} s={s} openSheet={openSheet} activeSubId={subjectId} />}
        {tab === 'оплата'  && <PaymentsPane key={s.id} s={s} left={left} openSheet={openSheet} notify={notify} activeSubId={subjectId} />}
        {tab === 'заметки' && <NotesPane key={s.id} s={s} notify={notify} />}
      </div>
    </div>
  );
};

/* ——— Tab panes ——— */

const OverviewPane = ({ s, left, openSheet, notify, skillsStore, activeSubId }) => {
  const skills = skillsStore.getSkills(s);
  const hidden = skillsStore.isHidden(s.id);
  const _nowOv = new Date();
  const _mruOv = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
  const _todayLabel = `на ${_nowOv.getDate()} ${_mruOv[_nowOv.getMonth()]}`;
  // Последняя заметка из notesList
  const _storedS = window.MK_STORE.getStudent(s.id);
  const _lastNote = (_storedS?.notesList || [])[0] || null;
  return (
  <>
    <div className="profile-section">
      <div className="section-h">
        <h3>Пакет <em>уроков</em></h3>
        <span className="tag">осталось {left} из {s.pack}</span>
      </div>
      {(() => {
        const isMainSub = !activeSubId || activeSubId === 'main';
        const activeSub = isMainSub ? null : (_storedS?.extraSubs || []).find(es => es.id === activeSubId);
        if (activeSub) {
          return <ExtraPackCard student={_storedS} esub={activeSub} openSheet={openSheet} />;
        }
        const profileSub = getProfileSubscriptionView(s.id, 'main');
        return (
          <>
            <PackCard s={profileSub || s} left={profileSub?.left ?? left} compact openSheet={openSheet} />
            <div style={{marginTop:12, display:'flex', gap:8, justifyContent:'flex-end'}}>
              <button className="btn btn-sm" onClick={() => openSheet('add-individual', { student: _storedS || s })}>
                + Разовый урок
              </button>
              <button className="btn btn-sm" onClick={() => openSheet('add-sub', { student: _storedS || s })}>
                + Добавить абонемент
              </button>
            </div>
          </>
        );
      })()}

      {/* Разовые уроки */}
      {((_storedS?.individualLessons) || []).length > 0 && (
        <div style={{marginTop:18}}>
          <div className="section-h">
            <h3>Разовые <em>уроки</em></h3>
            <span className="tag">{(_storedS.individualLessons||[]).length} шт.</span>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:8}}>
            {(_storedS.individualLessons||[]).slice().reverse().map(il => {
              const [yyyy,mm,dd] = il.date.split('-');
              const dateLabel = `${dd}.${mm}.${yyyy}`;
              const statusColors = { future:'var(--ink-faint)', done:'var(--forest)', absent:'var(--berry)', 'teacher-cancel':'var(--ink-faint)' };
              const statusLabels = { future:'Запланировано', done:'Проведено', absent:'Не пришёл', 'teacher-cancel':'Отменено педагогом' };
              return (
                <div key={il.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:'var(--paper-deep)',borderRadius:10,border:'1px solid var(--rule)'}}>
                  <div style={{width:8,height:8,borderRadius:'50%',background:statusColors[il.status]||'var(--ink-faint)',flexShrink:0}}></div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:14}}>{il.subject || 'Разовый урок'}</div>
                    <div style={{fontFamily:'JetBrains Mono',fontSize:10,color:'var(--ink-faint)',marginTop:2}}>
                      {dateLabel} · {il.time}{il.price ? ` · ${il.price.toLocaleString('ru-RU')} ₽` : ''}
                      {il.paid ? ' · оплачено' : il.paid === undefined && il.status !== 'future' ? '' : ' · ждёт оплаты'}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:6,alignItems:'center'}}>
                    <span style={{fontSize:11,color:statusColors[il.status]||'var(--ink-faint)'}}>{statusLabels[il.status]||il.status}</span>
                    {il.status === 'future' && (
                      <button className="btn btn-sm" style={{padding:'3px 8px',fontSize:11}} onClick={() => window.MK_STORE.updateIndividualLesson((_storedS||s).id, il.id, d=>({...d,status:'done'}))}>✓</button>
                    )}
                    <button className="btn btn-sm" style={{padding:'3px 8px',fontSize:11,color:'var(--berry)'}} onClick={() => window.MK_STORE.removeIndividualLesson((_storedS||s).id, il.id)}>×</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!hidden ? (
        <>
          <div className="section-h" style={{marginTop:24}}>
            <h3>Прогресс <em>ученика</em></h3>
            <span style={{display:'flex', gap: 10, alignItems:'center', fontFamily:'JetBrains Mono', fontSize: 10.5, letterSpacing:'.12em', color:'var(--ink-faint)', textTransform:'uppercase'}}>
              <span>{_todayLabel}</span>
              <button className="link-btn" onClick={() => { skillsStore.setHide(s.id, true); notify('Раздел «Прогресс» скрыт'); }}>
                <Icon name="x" size={10}/> скрыть
              </button>
            </span>
          </div>
          <EditableSkills
            key={s.id}
            skills={skills}
            onCommit={(next) => skillsStore.writeSkills(s.id, next)}
            notify={notify}
          />
        </>
      ) : (
        <div style={{marginTop: 18, padding: '14px 16px', border: '1px dashed var(--rule)', borderRadius: 12, display:'flex', alignItems:'center', gap: 12, background: 'var(--paper-deep)'}}>
          <div style={{flex: 1, fontFamily: 'Instrument Serif, serif', fontStyle: 'italic', fontSize: 16, color: 'var(--ink-soft)'}}>
            Блок «Прогресс ученика» скрыт для этого ученика.
          </div>
          <button className="btn btn-sm" onClick={() => { skillsStore.setHide(s.id, false); notify('Блок «Прогресс» возвращён'); }}>Показать</button>
        </div>
      )}
    </div>

    <div className="profile-section">
      <div className="section-h">
        <h3>Родитель <em>и контакты</em></h3>
        <span className="tag">основной</span>
      </div>
      <ParentBlock s={s} openSheet={openSheet} notify={notify} />

      {_lastNote ? (
        <>
          <div className="section-h" style={{marginTop:24}}>
            <h3>Моя <em>заметка</em></h3>
            <span className="tag">{_lastNote.date || '—'}{_lastNote.tag ? ` · ${_lastNote.tag}` : ''}</span>
          </div>
          <div className="font-serif italic" style={{fontSize:17, lineHeight:1.5, color:'var(--ink)', padding:'6px 0'}}>
            «{_lastNote.text}»
          </div>
        </>
      ) : (
        <>
          <div className="section-h" style={{marginTop:24}}>
            <h3>Моя <em>заметка</em></h3>
            <span className="tag">пока нет</span>
          </div>
          <div className="font-serif italic" style={{fontSize:15, lineHeight:1.5, color:'var(--ink-faint)', padding:'6px 0'}}>
            Откройте вкладку «Заметки» и добавьте первое наблюдение об ученике.
          </div>
        </>
      )}
    </div>
  </>
  );
};

// ── Модал заморозки абонемента ──
const FreezeModal = ({ student, freezeWeeksLeft, onClose }) => {
  const _iso = (offset = 0) => {
    const d = new Date(); d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const [from, setFrom] = React.useState(_iso(0));
  const [to, setTo]   = React.useState(_iso(7));
  const [comment, setComment] = React.useState('');

  const weeks = Math.max(1, Math.round((new Date(to) - new Date(from)) / (7 * 864e5)));
  const tooMany = weeks > freezeWeeksLeft;

  const apply = () => {
    const fromD = new Date(from + 'T00:00:00');
    const toD   = new Date(to   + 'T00:00:00');
    const note  = comment.trim() || `заморозка ${weeks} нед.`;
    updateSubData(student.id, d => {
      const lessons = (d.lessons || []).map(l => {
        if (l.status !== 'future') return l;
        const [dd, mm] = (l.date || '').split('.').map(Number);
        const lDate = new Date(fromD.getFullYear(), mm - 1, dd);
        if (lDate >= fromD && lDate <= toD) return {...l, status:'freeze', note};
        return l;
      });
      const events = [...(d.events||[]), {
        type: 'freeze',
        date: new Date().toLocaleDateString('ru-RU'),
        note: `Заморозка ${weeks} нед. (${from.slice(8)}.${from.slice(5,7)} — ${to.slice(8)}.${to.slice(5,7)})${comment ? ' · ' + comment : ''}`,
      }];
      return {...d, lessons, events, freezeUsed: (d.freezeUsed||0) + weeks};
    });
    onClose();
  };

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',zIndex:900,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{background:'var(--paper)',borderRadius:16,padding:28,width:'100%',maxWidth:440,boxShadow:'0 16px 48px -8px rgba(0,0,0,.35)'}}>
        <div style={{fontFamily:'Instrument Serif',fontSize:22,marginBottom:20}}>
          Заморозка <em style={{fontStyle:'italic',color:'var(--forest)'}}>абонемента</em>
        </div>

        <div className="fld" style={{marginBottom:14}}>
          <label>Количество недель</label>
          <div style={{fontFamily:'JetBrains Mono',fontSize:15,padding:'8px 12px',background:'var(--paper-deep)',borderRadius:8,color: tooMany ? 'var(--berry)' : 'var(--ink)'}}>
            {weeks} {weeks===1?'неделя':weeks<5?'недели':'недель'}
            {tooMany && <span style={{fontSize:11,marginLeft:8}}>— превышает лимит ({freezeWeeksLeft} нед.)</span>}
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
          <div className="fld">
            <label>С даты</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div className="fld">
            <label>По дату</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
        </div>

        <div className="fld" style={{marginBottom:20}}>
          <label>Комментарий</label>
          <textarea value={comment} onChange={e => setComment(e.target.value)}
            placeholder="Причина..."
            style={{resize:'vertical',minHeight:72,fontFamily:'inherit',fontSize:14,padding:'8px 12px',borderRadius:8,border:'1px solid var(--rule)',width:'100%',background:'var(--paper-deep)'}}
          />
        </div>

        <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
          <button className="btn btn-sm" onClick={onClose}>Отмена</button>
          <button className="btn btn-sm btn-primary" onClick={apply} disabled={tooMany || weeks < 1}>
            Заморозить
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Subscription helpers — теперь читают/пишут прямо в MK_STORE ──

const getSubData = (sid, pack) => {
  const s = window.MK_STORE.getStudent(sid);
  if (s && s.lessons && s.lessons.length) return s;
  // init fresh if no lessons
  const fresh = {
    totalSessions: pack || 8,
    freezeUsed: 0,
    freezeMax: 3,
    paid: new Date().toLocaleDateString('ru-RU'),
    price: (pack||8)*1600,
    days: [1,3],
    time: '15:00',
    lessons: Array.from({length: pack||8}, (_,i) => ({
      date: `${String(i+1).padStart(2,'0')}.05`,
      status: 'future',
      note: ''
    })),
    events: []
  };
  if (s) window.MK_STORE.updateStudent(sid, {...s, ...fresh});
  return fresh;
};

const updateSubData = (sid, updater) => {
  const s = window.MK_STORE.getStudent(sid);
  const updated = updater({...s});
  window.MK_STORE.updateStudent(sid, updated);
  return updated;
};

const getProfileSubscriptionView = (studentId, activeSubId = 'main') => {
  const legacyStudent = window.MK_STORE.getStudent(studentId);
  if (!legacyStudent) return null;

  const legacySub = activeSubId === 'main'
    ? legacyStudent
    : (legacyStudent.extraSubs || []).find((sub) => sub.id === activeSubId);
  const v2Sub = selectLegacyCompatibleSubscription(
    window.MK_STORAGE_MIGRATION?.store,
    studentId,
    activeSubId,
  );

  return v2Sub ? { ...(legacySub || {}), ...v2Sub } : (legacySub || null);
};

const MK_LESSON_LABELS = window.MK_LESSON_LABELS;
const MK_LESSON_STATUSES = window.MK_LESSON_STATUSES;

const hasCrossMk = (st) => ['transfer','sick','sick-wait','freeze','refund'].includes(st);

const LessonDotMk = ({ lesson, idx, onOpen }) => {
  const bgMap = {
    future: 'var(--paper-deep)', done: 'var(--forest)',
    transfer: 'var(--ochre-pale)', sick: 'var(--ochre-pale)', 'sick-wait': 'var(--ochre-pale)',
    freeze: 'var(--sky-pale)', refund: 'var(--berry-pale)',
    absent: 'var(--berry-pale)', 'teacher-cancel': 'var(--paper-deep)',
  };
  const colorMap = {
    future: 'var(--ink-faint)', done: 'oklch(0.97 0.02 85)',
    transfer: 'var(--ochre-deep)', sick: 'var(--ochre-deep)', 'sick-wait': 'var(--ochre-deep)',
    freeze: 'oklch(0.42 0.08 230)', refund: 'var(--berry)',
    absent: 'var(--berry)', 'teacher-cancel': 'var(--ink-faint)',
  };
  const borderMap = {
    future: '1.5px dashed var(--rule)', done: '1.5px solid var(--forest-deep)',
    transfer: '1.5px solid var(--ochre)', sick: '1.5px solid var(--ochre)',
    'sick-wait': '1.5px solid var(--ochre)', freeze: '1.5px solid var(--sky)',
    refund: '1.5px solid var(--berry)',
    absent: '1.5px solid var(--berry)', 'teacher-cancel': '1.5px dashed var(--rule)',
  };
  const st = lesson.status;
  return (
    <div style={{textAlign:'center', cursor:'pointer'}} onClick={() => onOpen(idx)}>
      <div style={{
        width:68, height:68, borderRadius:'50%',
        background: bgMap[st]||'var(--paper-deep)',
        color: colorMap[st]||'var(--ink-faint)',
        border: borderMap[st]||'1.5px dashed var(--rule)',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontFamily:'JetBrains Mono', fontSize:12, fontWeight:600,
        position:'relative', overflow:'hidden',
        transition:'transform .15s, box-shadow .15s',
      }}
        onMouseEnter={e=>{e.currentTarget.style.transform='scale(1.07)';e.currentTarget.style.boxShadow='0 4px 14px -4px rgba(40,35,15,.2)';}}
        onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='';}}
      >
        {hasCrossMk(st) && (
          <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
            <div style={{position:'absolute',width:'54%',height:1.5,background:'currentColor',opacity:.45,transform:'rotate(45deg)'}}></div>
            <div style={{position:'absolute',width:'54%',height:1.5,background:'currentColor',opacity:.45,transform:'rotate(-45deg)'}}></div>
          </div>
        )}
        {st==='done' && <div style={{position:'absolute',bottom:6,right:8,fontSize:11,opacity:.6}}>✓</div>}
        <span style={{position:'relative',zIndex:1}}>{lesson.date}</span>
      </div>
      <div style={{fontFamily:'JetBrains Mono',fontSize:9,letterSpacing:'.06em',textTransform:'uppercase',color:'var(--ink-faint)',marginTop:5,lineHeight:1.3,maxWidth:72}}>
        {lesson.note || MK_LESSON_LABELS[st] || ''}
      </div>
    </div>
  );
};

// Lesson status picker modal (inline)
const LessonStatusPicker = ({ lesson, idx, onSave, onClose }) => {
  const [status, setStatus] = React.useState(lesson.status);
  const [note, setNote] = React.useState(lesson.note||'');
  return (
    <div style={{position:'fixed',inset:0,zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(40,35,15,.35)'}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:'var(--paper-card)',borderRadius:18,padding:24,width:380,maxWidth:'95vw',boxShadow:'0 24px 64px rgba(0,0,0,.18)',maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{fontFamily:'JetBrains Mono',fontSize:10,letterSpacing:'.14em',textTransform:'uppercase',color:'var(--ink-faint)',marginBottom:6}}>занятие · {lesson.date}</div>
        <h2 style={{fontFamily:'Instrument Serif',fontSize:24,marginBottom:18}}>Статус <em style={{fontStyle:'italic',color:'var(--forest)'}}>занятия</em></h2>
        <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:16}}>
          {MK_LESSON_STATUSES.map(st => (
            <div key={st.k} onClick={()=>setStatus(st.k)} style={{
              display:'flex',alignItems:'center',gap:12,padding:'11px 14px',borderRadius:10,cursor:'pointer',
              border: status===st.k?'1px solid var(--forest)':'1px solid var(--rule)',
              background: status===st.k?'var(--moss-pale)':'transparent',
              transition:'all .13s'
            }}>
              <div style={{width:8,height:8,borderRadius:'50%',background:st.color,flexShrink:0}}></div>
              <span style={{fontSize:14,fontWeight:500,color:st.color}}>{st.label}</span>
            </div>
          ))}
        </div>
        <div style={{marginBottom:16}}>
          <div style={{fontFamily:'JetBrains Mono',fontSize:10,letterSpacing:'.1em',textTransform:'uppercase',color:'var(--ink-faint)',marginBottom:5}}>Комментарий / дата переноса</div>
          <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Напр: отработка 23.05"
            style={{width:'100%',padding:'9px 12px',border:'1px solid var(--rule)',borderRadius:10,fontFamily:'Manrope',fontSize:13,outline:'none',background:'var(--paper-card)',color:'var(--ink)'}}/>
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
          <button className="btn btn-sm" onClick={onClose}>Отмена</button>
          <button className="btn btn-sm btn-primary" onClick={()=>onSave(idx,status,note)}>Сохранить</button>
        </div>
      </div>
    </div>
  );
};

const LessonsPane = ({ s, openSheet, activeSubId }) => {
  const stored = window.MK_STORE.getStudent(s.id);
  const legacyMainSub = stored && stored.lessons && stored.lessons.length ? stored : getSubData(s.id, s.pack||s.totalSessions||8);
  const mainSub = getProfileSubscriptionView(s.id, 'main') || legacyMainSub;
  const extraSubs = stored?.extraSubs || [];

  const [subTab, setSubTab] = React.useState('main');
  const [picker, setPicker] = React.useState(null);
  const [showFreeze, setShowFreeze] = React.useState(false);

  const currentSub = activeSubId !== undefined ? activeSubId : subTab;
  const isMain = currentSub === 'main';
  const legacySub = isMain ? legacyMainSub : (extraSubs.find(es => es.id === currentSub) || legacyMainSub);
  const sub = getProfileSubscriptionView(s.id, currentSub) || legacySub;

  const left = sub.left ?? (sub.lessons||[]).filter(l=>l.status==='future'||l.status==='sick-wait').length;
  const done = sub.used ?? (sub.lessons||[]).filter(l=>l.status==='done').length;

  const saveLesson = (idx, status, note) => {
    validateLegacyLessonStatusChange({
      store: window.MK_STORAGE_MIGRATION?.store,
      studentId: s.id,
      activeSubId: currentSub,
      lessonIndex: idx,
      legacyStatus: status,
      note,
      changedAt: new Date().toISOString(),
    });
    if (isMain) {
      updateSubData(s.id, d => {
        const lessons = [...(d.lessons||[])];
        lessons[idx] = {...lessons[idx], status, note};
        const events = [...(d.events||[]), {
          type: status, date: new Date().toLocaleDateString('ru-RU'),
          note: `${MK_LESSON_LABELS[status]||status} (${lessons[idx].date})${note?' → '+note:''}`
        }];
        return {...d, lessons, events};
      });
    } else {
      window.MK_STORE.updateExtraSub(s.id, currentSub, d => {
        const lessons = [...(d.lessons||[])];
        lessons[idx] = {...lessons[idx], status, note};
        return {...d, lessons};
      });
    }
    setPicker(null);
  };

  const freezeWeeksLeft = (mainSub.freezeMax||3) - (mainSub.freezeUsed||0);

  return (
  <>
    {showFreeze && <FreezeModal student={mainSub} freezeWeeksLeft={freezeWeeksLeft} onClose={() => setShowFreeze(false)} />}
    {picker !== null && sub.lessons && sub.lessons[picker] && (
      <LessonStatusPicker
        lesson={sub.lessons[picker]}
        idx={picker}
        onSave={saveLesson}
        onClose={()=>setPicker(null)}
      />
    )}

    <div className="profile-section">
      {extraSubs.length > 0 && activeSubId === undefined && (
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}>
          <button className={`choice ${currentSub==='main'?'on':''}`} onClick={()=>setSubTab('main')}>Основной</button>
          {extraSubs.map(es => (
            <button key={es.id} className={`choice ${currentSub===es.id?'on':''}`} onClick={()=>setSubTab(es.id)}>{es.subject}</button>
          ))}
        </div>
      )}
      <div className="section-h">
        <h3>Занятия <em>{isMain ? 'абонемента' : (sub.subject || 'абонемента')}</em></h3>
        <span className="tag">нажмите для изменения</span>
      </div>
      <div style={{display:'flex',flexWrap:'wrap',gap:10,marginTop:4}}>
        {(sub.lessons||[]).map((l,i) => <LessonDotMk key={i} lesson={l} idx={i} onOpen={setPicker}/>)}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginTop:20}}>
        {[['Осталось',left,left<=0?'var(--berry)':left<=2?'var(--ochre-deep)':'var(--ink)'],['Проведено',done,'var(--forest)'],['Всего',sub.totalSessions ?? sub.pack,'var(--ink-faint)']].map(([l,v,c])=>(
          <div key={l} style={{background:'var(--paper-deep)',borderRadius:10,padding:'12px 14px'}}>
            <div style={{fontFamily:'JetBrains Mono',fontSize:10,letterSpacing:'.12em',textTransform:'uppercase',color:'var(--ink-faint)',marginBottom:4}}>{l}</div>
            <div style={{fontFamily:'Instrument Serif',fontSize:28,lineHeight:1,color:c}}>{v}</div>
          </div>
        ))}
      </div>

      {sub.queuedPack && (
        <div style={{marginTop:14, padding:'10px 14px', background:'var(--sky-pale)', borderRadius:8, border:'1px solid var(--sky)', display:'flex', alignItems:'center', gap:10, fontSize:13}}>
          <span style={{flex:1}}>
            📦 В очереди: <strong>{sub.queuedPack.packSize} уроков</strong> · старт с {sub.queuedPack.startDate.split('-').reverse().slice(0,2).join('.')}
            {sub.queuedPack.paid ? ' · оплачено' : ' · ждёт оплаты'}
          </span>
          <button className="btn btn-sm" style={{color:'var(--berry)'}} onClick={() => window.MK_STORE.updateStudent(s.id, d => ({...d, queuedPack: null}))}>
            Отменить
          </button>
        </div>
      )}
    </div>

    {isMain && (
    <div className="profile-section">
      <div className="section-h">
        <h3>Заморозка <em>абонемента</em></h3>
        <span className="tag">использовано {mainSub.freezeUsed||0} из {mainSub.freezeMax||3} нед.</span>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:10,background:'var(--sky-pale)',borderRadius:10,border:'1px solid oklch(0.82 0.06 225)',padding:'10px 14px',marginBottom:12}}>
        <span style={{fontFamily:'JetBrains Mono',fontSize:12,color:'oklch(0.42 0.08 230)',flex:1}}>Недель заморозки: {mainSub.freezeUsed||0} / {mainSub.freezeMax||3}</span>
        <div style={{display:'flex',gap:5}}>
          {Array.from({length:mainSub.freezeMax||3},(_,i)=>(
            <div key={i} style={{width:10,height:10,borderRadius:'50%',background:i<(mainSub.freezeUsed||0)?'oklch(0.52 0.1 230)':'var(--rule)'}}></div>
          ))}
        </div>
      </div>
      {freezeWeeksLeft > 0 && (
        <button className="btn btn-sm" style={{width:'100%',justifyContent:'center'}} onClick={() => setShowFreeze(true)}>
          ❄ Заморозить
        </button>
      )}
    </div>
    )}

    <div className="profile-section">
      <div className="section-h">
        <h3>История <em>событий</em></h3>
        <span className="tag">{(sub.events||[]).length} записей</span>
      </div>
      {(sub.events||[]).length===0 && <div className="font-serif italic" style={{fontSize:16,color:'var(--ink-soft)'}}>Нет событий</div>}
      <div style={{display:'flex',flexDirection:'column',gap:0}}>
        {(sub.events||[]).slice().reverse().slice(0,8).map((e,i)=>{
          const dc=e.type==='payment'?'var(--forest)':e.type==='freeze'?'oklch(0.52 0.1 230)':e.type==='refund'?'var(--berry)':'var(--ochre)';
          return (
            <div key={i} style={{display:'flex',gap:12,padding:'10px 0',borderTop:i?'1px dashed var(--rule)':'none',alignItems:'flex-start'}}>
              <div style={{width:8,height:8,borderRadius:'50%',background:dc,flexShrink:0,marginTop:5}}></div>
              <div>
                <div style={{fontSize:13,lineHeight:1.4}}>{e.note}</div>
                <div style={{fontFamily:'JetBrains Mono',fontSize:10,color:'var(--ink-faint)',letterSpacing:'.08em',marginTop:2}}>{e.date}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </>
  );
};

const PaymentsPane = ({ s, left, openSheet, notify, activeSubId }) => {
  const stored = window.MK_STORE.getStudent(s.id) || s;
  const _mruShort = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
  const isMainSub = !activeSubId || activeSubId === 'main';
  const activeSub = isMainSub ? null : (stored.extraSubs || []).find(es => es.id === activeSubId);
  const events = isMainSub ? (stored.events || []) : (activeSub?.events || []);
  const [editIdx, setEditIdx] = React.useState(-1);
  const [draftAmount, setDraftAmount] = React.useState(0);
  const [draftPending, setDraftPending] = React.useState(false);
  const [draftMethod, setDraftMethod] = React.useState('');

  const allPayments = events
    .map((e, eventIdx) => ({ e, eventIdx }))
    .filter(x => x.e.type === 'payment' || x.e.type === 'payment-pending');

  const sorted = allPayments.map(({ e, eventIdx }) => {
    const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(e.date || '');
    if (!m) return null;
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10) - 1;
    const year = parseInt(m[3], 10);
    const rub = (e.note || '').match(/([\d\s ]+)\s*₽/);
    const amount = rub ? parseInt(rub[1].replace(/[\s ]/g, ''), 10) : (activeSub?.price || s.price || 0);
    const lessonsMatch = (e.note || '').match(/(\d+)\s*заня/);
    const lessonsCount = lessonsMatch ? lessonsMatch[1] : '';
    const methodMatch = (e.note || '').match(/(СБП|Карта|Наличные)/);
    const method = methodMatch ? methodMatch[1] : '';
    return {
      eventIdx, originalEvent: e,
      day, month, year, sortKey: year * 10000 + month * 100 + day,
      lessonsLabel: lessonsCount ? `${lessonsCount} уроков` : 'пакет',
      lessonsCount, method, amount,
      pending: e.type === 'payment-pending',
    };
  }).filter(Boolean).sort((a, b) => b.sortKey - a.sortKey);

  const packNumber = String(sorted.length).padStart(4, '0');

  const beginEdit = (p) => {
    setEditIdx(p.eventIdx);
    setDraftAmount(p.amount);
    setDraftPending(p.pending);
    setDraftMethod(p.method || 'СБП');
  };
  const cancelEdit = () => { setEditIdx(-1); };

  const saveEdit = (p) => {
    const amt = parseInt(draftAmount, 10) || 0;
    const newNote = draftPending
      ? `Ждёт оплаты · ${p.lessonsCount || ''}${p.lessonsCount ? ' занятий — ' : ''}${amt.toLocaleString('ru-RU')} ₽`
      : `Оплата · ${p.lessonsCount || ''}${p.lessonsCount ? ' занятий — ' : ''}${amt.toLocaleString('ru-RU')} ₽${draftMethod ? ' · ' + draftMethod : ''}`;
    const newType = draftPending ? 'payment-pending' : 'payment';
    if (isMainSub) {
      window.MK_STORE.updateStudent(s.id, st => ({
        ...st,
        events: (st.events || []).map((e, i) => i === p.eventIdx ? { ...e, type: newType, note: newNote } : e),
      }));
    } else {
      window.MK_STORE.updateExtraSub(s.id, activeSubId, d => ({
        ...d,
        events: (d.events || []).map((e, i) => i === p.eventIdx ? { ...e, type: newType, note: newNote } : e),
      }));
    }
    setEditIdx(-1);
    notify && notify('Платёж обновлён', 'ok');
  };

  const deleteEvent = (p) => {
    if (!window.confirm('Удалить это событие? Платёж больше не будет учитываться в отчётах.')) return;
    if (isMainSub) {
      window.MK_STORE.updateStudent(s.id, st => ({
        ...st,
        events: (st.events || []).filter((_, i) => i !== p.eventIdx),
      }));
    } else {
      window.MK_STORE.updateExtraSub(s.id, activeSubId, d => ({
        ...d,
        events: (d.events || []).filter((_, i) => i !== p.eventIdx),
      }));
    }
    if (editIdx === p.eventIdx) setEditIdx(-1);
    notify && notify('Платёж удалён', 'ok');
  };

  const resetPack = () => {
    if (!window.confirm('Сбросить текущий пакет ученика? Все слоты текущего пакета будут удалены, история событий останется.')) return;
    const oldDone = (stored.lessons || []).filter(l => l.status === 'done');
    window.MK_STORE.updateStudent(s.id, st => ({
      ...st,
      lessons: [],
      pack: 0,
      used: 0,
      archivedLessons: [...(st.archivedLessons || []), ...oldDone],
    }));
    notify && notify('Пакет сброшен — нажмите Продлить чтобы начать новый', 'ok');
  };

  return (
  <div style={{gridColumn:'1/-1', display:'flex', flexWrap:'wrap', gap:28, alignItems:'flex-start'}}>
    <div className="profile-section" style={{flex:'0 0 300px', minWidth:0}}>
      <div className="section-h">
        <h3>Текущий <em>пакет</em></h3>
        <span className="tag">{sorted.length > 0 ? `№ ${packNumber}` : 'нет платежей'}</span>
      </div>
      {activeSub
        ? <ExtraPackCard student={stored} esub={activeSub} openSheet={openSheet} />
        : <PackCard s={getProfileSubscriptionView(s.id, 'main') || s} left={getProfileSubscriptionView(s.id, 'main')?.left ?? left} openSheet={openSheet} />
      }
      {isMainSub && (s.pack || 0) > 0 && (
        <div style={{marginTop:10, textAlign:'right'}}>
          <button onClick={resetPack} style={{
            border:'none', background:'transparent', cursor:'pointer',
            fontSize:11.5, color:'var(--ink-faint)', fontFamily:'Manrope',
            padding:'4px 8px', borderRadius:6,
          }}
            onMouseEnter={e => e.currentTarget.style.color='var(--berry)'}
            onMouseLeave={e => e.currentTarget.style.color='var(--ink-faint)'}
          >
            что-то не так с пакетом? сбросить и начать заново
          </button>
        </div>
      )}
    </div>
    <div className="profile-section" style={{flex:'1 1 400px', minWidth:0}}>
      <div className="section-h">
        <h3>История <em>платежей</em></h3>
        <span className="tag">{sorted.length === 0 ? 'пока пусто' : `${sorted.length} ${sorted.length === 1 ? 'запись' : sorted.length < 5 ? 'записи' : 'записей'}`}</span>
      </div>
      <div style={{display:'flex', flexDirection:'column', gap:0}}>
        {sorted.length === 0 ? (
          <div className="font-serif italic" style={{fontSize:15, color:'var(--ink-faint)', padding:'10px 0'}}>
            Платежей пока не было. Нажмите «Продлить пакет» в разделе «Пакет уроков» — там можно записать первую оплату.
          </div>
        ) : sorted.map((p, i) => editIdx === p.eventIdx ? (
          <div key={p.eventIdx} style={{padding:'14px 16px', border:'1px solid var(--forest)', borderRadius:12, background:'var(--moss-pale)', marginTop: i ? 10 : 0}}>
            <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:10}}>
              <span style={{fontFamily:'JetBrains Mono', fontSize:10, letterSpacing:'.14em', textTransform:'uppercase', color:'var(--ink-faint)'}}>
                редактирование · {String(p.day).padStart(2,'0')} {_mruShort[p.month]} {p.year}
              </span>
            </div>
            <div className="fld-row">
              <div className="fld" style={{marginBottom:10}}>
                <label>Сумма ₽</label>
                <input type="number" value={draftAmount} onChange={e => setDraftAmount(e.target.value)} />
              </div>
              <div className="fld" style={{marginBottom:10}}>
                <label>Статус</label>
                <div className="choices">
                  <button className={`choice ${!draftPending ? 'on' : ''}`} onClick={() => setDraftPending(false)}>✓ Оплачено</button>
                  <button className={`choice ${draftPending ? 'on' : ''}`} onClick={() => setDraftPending(true)}>⌛ Ждёт</button>
                </div>
              </div>
            </div>
            {!draftPending && (
              <div className="fld" style={{marginBottom:10}}>
                <label>Способ оплаты</label>
                <div className="choices">
                  {['СБП','Карта','Наличные'].map(m => (
                    <button key={m} className={`choice ${draftMethod === m ? 'on' : ''}`} onClick={() => setDraftMethod(m)}>{m}</button>
                  ))}
                </div>
              </div>
            )}
            <div style={{display:'flex', justifyContent:'flex-end', gap:8, marginTop:10, paddingTop:10, borderTop:'1px dashed var(--rule)'}}>
              <button className="btn btn-sm" onClick={() => deleteEvent(p)} style={{color:'var(--berry)'}}>
                <Icon name="x" size={13}/> Удалить
              </button>
              <span className="grow"></span>
              <button className="btn btn-sm" onClick={cancelEdit}>Отмена</button>
              <button className="btn btn-sm btn-primary" onClick={() => saveEdit(p)}>Сохранить</button>
            </div>
          </div>
        ) : (
          <div key={p.eventIdx} className="payment-row" style={{display:'grid', gridTemplateColumns:'auto 1fr auto auto auto', gap:14, padding:'14px 0', borderTop: i ? '1px dashed var(--rule)' : 'none', alignItems:'center'}}>
            <div className="font-serif italic" style={{fontSize:18, color:'var(--ink)', minWidth:90}}>
              {String(p.day).padStart(2,'0')} {_mruShort[p.month]} {p.year}
            </div>
            <div>
              <div style={{fontWeight:600, fontSize:14}}>{p.lessonsLabel}</div>
              {p.method && (
                <div style={{fontFamily:'JetBrains Mono', fontSize:10.5, color:'var(--ink-faint)', letterSpacing:'.08em', marginTop:2}}>{p.method.toUpperCase()}</div>
              )}
            </div>
            <div className="font-mono" style={{fontSize:14, fontWeight:600}}>{p.amount.toLocaleString('ru-RU')} ₽</div>
            <span className={`pill ${p.pending ? '' : 'green'}`} style={{textTransform:'lowercase'}}>
              {p.pending ? 'ждёт' : 'оплачен'}
            </span>
            <div style={{display:'flex', gap:4}}>
              <button onClick={() => beginEdit(p)} title="Редактировать" style={{
                width:26, height:26, padding:0, display:'grid', placeItems:'center', cursor:'pointer',
                border:'none', background:'transparent', color:'var(--ink-faint)', borderRadius:6,
              }} onMouseEnter={e => e.currentTarget.style.color='var(--forest)'} onMouseLeave={e => e.currentTarget.style.color='var(--ink-faint)'}>
                <Icon name="edit" size={13}/>
              </button>
              <button onClick={() => deleteEvent(p)} title="Удалить" style={{
                width:26, height:26, padding:0, display:'grid', placeItems:'center', cursor:'pointer',
                border:'none', background:'transparent', color:'var(--ink-faint)', borderRadius:6,
              }} onMouseEnter={e => e.currentTarget.style.color='var(--berry)'} onMouseLeave={e => e.currentTarget.style.color='var(--ink-faint)'}>
                <Icon name="x" size={13}/>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
  );
};

const NotesPane = ({ s, notify }) => {
  const [draft, setDraft] = React.useState('');
  const [tag, setTag] = React.useState('наблюдение');
  const [notes, setNotes] = React.useState(() => {
    const stored = window.MK_STORE.getStudent(s.id);
    return stored?.notesList || (s.notes ? [{date:'—', tag:'наблюдение', text: s.notes}] : []);
  });
  const [editIdx, setEditIdx] = React.useState(-1);
  const [editText, setEditText] = React.useState('');
  const [editTag, setEditTag] = React.useState('наблюдение');

  const persist = (next) => {
    setNotes(next);
    window.MK_STORE.updateStudent(s.id, st => ({...st, notesList: next}));
  };

  const save = () => {
    const text = draft.trim();
    if (!text) { notify && notify('Напишите текст заметки'); return; }
    const months = ['ЯНВ','ФЕВ','МАР','АПР','МАЯ','ИЮН','ИЮЛ','АВГ','СЕН','ОКТ','НОЯ','ДЕК'];
    const d = new Date();
    const date = `${String(d.getDate()).padStart(2,'0')} ${months[d.getMonth()]}`;
    persist([{ date, tag, text }, ...notes]);
    setDraft('');
    notify && notify('Заметка сохранена');
  };

  const beginEdit = (i) => {
    setEditIdx(i);
    setEditText(notes[i].text);
    setEditTag(notes[i].tag || 'наблюдение');
  };

  const cancelEdit = () => { setEditIdx(-1); setEditText(''); };

  const saveEdit = () => {
    const text = editText.trim();
    if (!text) { notify && notify('Текст не может быть пустым'); return; }
    const next = notes.map((n, idx) => idx === editIdx ? { ...n, text, tag: editTag } : n);
    persist(next);
    setEditIdx(-1); setEditText('');
    notify && notify('Заметка обновлена');
  };

  const remove = (i) => {
    if (!window.confirm('Удалить эту заметку?')) return;
    persist(notes.filter((_, idx) => idx !== i));
    if (editIdx === i) cancelEdit();
    notify && notify('Заметка удалена');
  };

  return (
  <>
    <div className="profile-section">
      <div className="section-h">
        <h3>Мои <em>заметки</em></h3>
        <span className="tag">{notes.length} записей</span>
      </div>
      <div style={{display:'flex', flexDirection:'column', gap:18}}>
        {notes.map((n, i) => editIdx === i ? (
          <div key={i} style={{padding:'14px 16px', border:'1px solid var(--forest)', borderRadius:12, background:'var(--paper-deep)'}}>
            <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:8}}>
              <span style={{fontFamily:'JetBrains Mono', fontSize:10, letterSpacing:'.14em', color:'var(--ink-faint)'}}>{n.date}</span>
              <div style={{display:'flex', gap:6}}>
                {['наблюдение','программа','болезнь'].map(tg => (
                  <button key={tg} onClick={() => setEditTag(tg)} style={{
                    padding:'3px 9px', borderRadius:999, fontSize:11, letterSpacing:'.05em', cursor:'pointer',
                    border:'1px solid ' + (editTag === tg ? 'var(--forest)' : 'var(--rule)'),
                    background: editTag === tg ? 'var(--forest)' : 'var(--paper-card)',
                    color: editTag === tg ? 'oklch(0.97 0.02 85)' : 'var(--ink-soft)',
                    fontFamily:'Manrope, sans-serif',
                  }}>{tg}</button>
                ))}
              </div>
            </div>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              autoFocus
              style={{width:'100%', minHeight:64, border:'none', outline:'none', background:'transparent',
                      resize:'vertical', fontFamily:'Instrument Serif, serif', fontStyle:'italic',
                      fontSize:17, lineHeight:1.45, color:'var(--ink)'}}
            />
            <div style={{display:'flex', justifyContent:'flex-end', gap:8, marginTop:10, paddingTop:10, borderTop:'1px dashed var(--rule)'}}>
              <button className="btn btn-sm" onClick={cancelEdit}>Отмена</button>
              <button className="btn btn-sm btn-primary" onClick={saveEdit}>Сохранить</button>
            </div>
          </div>
        ) : (
          <div key={i} className="note-card" style={{position:'relative', padding:'14px 16px', border:'1px solid var(--rule)', borderRadius:12, background:'oklch(0.97 0.018 82)'}}>
            <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:6}}>
              <span style={{fontFamily:'JetBrains Mono', fontSize:10, letterSpacing:'.14em', color:'var(--ink-faint)'}}>{n.date}</span>
              <div style={{display:'flex', alignItems:'center', gap:8}}>
                <Pill tone={n.tag === 'болезнь' ? 'berry' : n.tag === 'программа' ? 'ochre' : 'green'}>{n.tag}</Pill>
                <button onClick={() => beginEdit(i)} title="Редактировать" style={{
                  width:24, height:24, padding:0, display:'grid', placeItems:'center', cursor:'pointer',
                  border:'none', background:'transparent', color:'var(--ink-faint)', borderRadius:6,
                }} onMouseEnter={e => e.currentTarget.style.color='var(--forest)'} onMouseLeave={e => e.currentTarget.style.color='var(--ink-faint)'}>
                  <Icon name="edit" size={13}/>
                </button>
                <button onClick={() => remove(i)} title="Удалить" style={{
                  width:24, height:24, padding:0, display:'grid', placeItems:'center', cursor:'pointer',
                  border:'none', background:'transparent', color:'var(--ink-faint)', borderRadius:6,
                }} onMouseEnter={e => e.currentTarget.style.color='var(--berry)'} onMouseLeave={e => e.currentTarget.style.color='var(--ink-faint)'}>
                  <Icon name="x" size={13}/>
                </button>
              </div>
            </div>
            <div className="font-serif italic" style={{fontSize:16, lineHeight:1.45, color:'var(--ink)'}}>{n.text}</div>
          </div>
        ))}
      </div>
    </div>

    <div className="profile-section">
      <div className="section-h">
        <h3>Новая <em>запись</em></h3>
        <span className="tag">после урока</span>
      </div>
      <div style={{border:'1px dashed var(--rule)', borderRadius:12, padding:'14px 16px', background:'var(--paper-deep)'}}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="напишите, что заметили сегодня…"
          style={{width:'100%', minHeight:64, border:'none', outline:'none', background:'transparent',
                  resize:'vertical', fontFamily:'Instrument Serif, serif', fontStyle:'italic',
                  fontSize:17, lineHeight:1.45, color:'var(--ink)'}}
        />
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:10, paddingTop:10, borderTop:'1px dashed var(--rule)'}}>
          <div style={{display:'flex', gap:6}}>
            {['наблюдение','программа','болезнь'].map(tg => (
              <button key={tg} onClick={() => setTag(tg)} style={{
                padding:'4px 10px', borderRadius:999, fontSize:11, letterSpacing:'.05em', cursor:'pointer',
                border:'1px solid ' + (tag === tg ? 'var(--forest)' : 'var(--rule)'),
                background: tag === tg ? 'var(--forest)' : 'var(--paper-card)',
                color: tag === tg ? 'oklch(0.97 0.02 85)' : 'var(--ink-soft)',
                fontFamily:'Manrope, sans-serif',
              }}>{tg}</button>
            ))}
          </div>
          <button className="btn btn-sm btn-primary" onClick={save}>Сохранить</button>
        </div>
      </div>
    </div>
  </>
  );
};

/* ——— Reusable pieces ——— */

const ExtraPackCard = ({ student, esub, openSheet }) => {
  const profileSub = getProfileSubscriptionView(student.id, esub.id);
  const displaySub = profileSub || esub;
  const left = displaySub.left ?? ((displaySub.pack || 0) - (displaySub.used || 0));
  const DAY_LABELS = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
  const daysLabel = (displaySub.days || []).map(d => DAY_LABELS[d]).join('/');
  return (
    <div className="pack" style={{marginTop:20}}>
      <div className="pack-top">
        <div>
          <div className="pack-label">{esub.subject || 'Доп. занятие'}{daysLabel ? ` · ${daysLabel}` : ''}</div>
          <div className="pack-num"><em>{esub.used}</em>/{esub.pack} <span className="pack-of italic">уроков</span></div>
        </div>
        <div style={{textAlign:'right'}}>
          <div className="pack-label">оплачен</div>
          <div className="font-serif italic" style={{fontSize:18,marginTop:4}}>{esub.paid || '—'}</div>
        </div>
      </div>
      <div className="stamps">
        {Array.from({length: esub.pack}, (_, i) => {
          if (i < esub.used) return <div key={i} className="stamp used" style={{'--rot':`${(i*37)%17-8}deg`}}>✓</div>;
          if (i === esub.used) return <div key={i} className="stamp next">{i+1}</div>;
          return <div key={i} className="stamp">{i+1}</div>;
        })}
      </div>
      {esub.queuedPack && (
        <div style={{marginTop:10,padding:'8px 12px',background:'var(--sky-pale)',borderRadius:8,border:'1px solid var(--sky)',display:'flex',alignItems:'center',gap:10,fontSize:12}}>
          <span style={{flex:1}}>📦 В очереди: {esub.queuedPack.packSize} уроков · старт с {esub.queuedPack.startDate.split('-').reverse().slice(0,2).join('.')}</span>
          <button className="btn btn-sm" style={{color:'var(--berry)'}} onClick={() => window.MK_STORE.updateExtraSub(student.id, esub.id, d=>({...d,queuedPack:null}))}>Отменить</button>
        </div>
      )}
      <div className="pack-foot">
        <span>{left===0?'Пакет израсходован':left===1?'⚠ Заканчивается':'Идём в графике'}</span>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-sm" style={{color:'var(--berry)',borderColor:'oklch(0.87 0.06 20)'}}
            onClick={()=>{ if(window.confirm(`Удалить абонемент «${esub.subject}»?`)) window.MK_STORE.removeExtraSub(student.id, esub.id); }}>
            Удалить
          </button>
          <button className="btn btn-sm btn-primary" onClick={()=>openSheet('renew-extra',{student, extraSubId:esub.id})}>Продлить</button>
        </div>
      </div>
    </div>
  );
};

const PackCard = ({ s, left, compact, openSheet }) => (
  <div className="pack">
    <div className="pack-top">
      <div>
        <div className="pack-label">текущий пакет</div>
        <div className="pack-num"><em>{s.used}</em>/{s.pack} <span className="pack-of italic">уроков</span></div>
      </div>
      <div style={{textAlign:'right'}}>
        <div className="pack-label">оплачен</div>
        <div className="font-serif italic" style={{fontSize:18, marginTop:4}}>{s.paid || '—'}</div>
      </div>
    </div>
    <div className="stamps">
      {Array.from({length: s.pack}, (_, i) => {
        if (i < s.used) {
          return <div key={i} className="stamp used" style={{ '--rot': `${(i*37)%17 - 8}deg` }}>✓</div>;
        }
        if (i === s.used) {
          return <div key={i} className="stamp next">{i+1}</div>;
        }
        return <div key={i} className="stamp">{i+1}</div>;
      })}
    </div>
    <div className="pack-foot">
      <span>{left === 0 ? 'Пакет израсходован — доступ к карточке скоро будет закрыт' :
             left === 1 ? '⚠ Заканчивается. Напомните родителям о продлении.' :
             'Идём в графике'}</span>
      <button className="btn btn-sm btn-primary" onClick={() => openSheet && openSheet('renew', { student: s })}>Продлить</button>
    </div>
  </div>
);

const EditableSkills = ({ skills: initial, onCommit, notify }) => {
  const [skills, setSkills] = React.useState(initial);
  const [editing, setEditing] = React.useState(null); // index being renamed

  // re-seed when switching students (key on parent handles remount, but be safe)
  React.useEffect(() => { setSkills(initial); /* eslint-disable-next-line */ }, []);

  const commit = (next) => { setSkills(next); onCommit(next); };

  const update = (i, patch) => commit(skills.map((sk, idx) => idx === i ? { ...sk, ...patch } : sk));
  const remove = (i) => { commit(skills.filter((_, idx) => idx !== i)); notify && notify('Навык удалён'); };
  const add = () => {
    const next = [...skills, { name: '', value: 50 }];
    setSkills(next);
    setEditing(next.length - 1);
  };

  if (skills.length === 0) {
    return (
      <div style={{padding: '18px 16px', textAlign: 'center', border: '1px dashed var(--rule)', borderRadius: 12, background: 'var(--paper-deep)'}}>
        <div className="font-serif italic" style={{fontSize: 16, color: 'var(--ink-soft)', marginBottom: 10}}>
          Пока нет навыков для отслеживания.
        </div>
        <button className="btn btn-sm btn-primary" onClick={add}>
          <Icon name="plus" size={13}/> Добавить навык
        </button>
      </div>
    );
  }

  return (
    <div className="skills">
      {skills.map((sk, i) => {
        const tone = sk.value >= 75 ? '' : sk.value >= 50 ? 'ochre' : 'berry';
        return (
          <div key={i} className="skill skill-editable">
            <div className="skill-row">
              {editing === i ? (
                <input
                  className="skill-name-input"
                  autoFocus
                  value={sk.name}
                  onChange={e => update(i, { name: e.target.value })}
                  onBlur={() => { setEditing(null); if (!sk.name.trim()) remove(i); }}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') e.target.blur(); }}
                  placeholder="название навыка…"
                />
              ) : (
                <span className="skill-name skill-name-clickable" onClick={() => setEditing(i)}>
                  {sk.name || <em style={{color: 'var(--ink-faint)'}}>без названия</em>}
                </span>
              )}
              <span className="skill-controls">
                <input
                  className="skill-val-input"
                  type="number"
                  min={0} max={100}
                  value={sk.value}
                  onChange={e => update(i, { value: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                />
                <span style={{fontFamily:'JetBrains Mono', fontSize: 11, color: 'var(--ink-faint)'}}>/100</span>
                <button className="skill-del" onClick={() => remove(i)} aria-label="Удалить навык">
                  <Icon name="x" size={11}/>
                </button>
              </span>
            </div>
            <input
              type="range"
              className={`skill-range ${tone}`}
              min={0} max={100}
              value={sk.value}
              onChange={e => update(i, { value: Number(e.target.value) })}
            />
            <div className={`skill-bar ${tone}`}>
              <span style={{ width: `${sk.value}%` }}></span>
            </div>
          </div>
        );
      })}
      <button className="skill-add" onClick={add}>
        <Icon name="plus" size={12}/> Добавить навык
      </button>
    </div>
  );
};

const SkillBars = ({ s }) => (
  <div className="skills">
    {Object.entries(s.scores).map(([k, v]) => {
      const tone = v >= 75 ? '' : v >= 50 ? 'ochre' : 'berry';
      return (
        <div key={k} className="skill">
          <div className="skill-row">
            <span className="skill-name">{k}</span>
            <span className="skill-val">{v}/100</span>
          </div>
          <div className={`skill-bar ${tone}`}>
            <span style={{ width: `${v}%` }}></span>
          </div>
        </div>
      );
    })}
  </div>
);

const ParentBlock = ({ s, openSheet, notify }) => {
  const stored = window.MK_STORE.getStudent(s.id) || s;

  // Автомиграция: если нет contacts[], берём legacy parent+phone
  const contacts = (() => {
    if (stored.contacts && stored.contacts.length) return stored.contacts;
    if (stored.parent) return [{ id: 'ct_main', name: stored.parent, phone: stored.phone || '', role: 'родитель' }];
    return [];
  })();

  const removeContact = (ctId) => {
    if (!window.confirm('Удалить этот контакт?')) return;
    const next = contacts.filter(c => c.id !== ctId);
    window.MK_STORE.updateStudent(s.id, d => ({ ...d, contacts: next }));
  };

  return (
    <div style={{display:'flex', flexDirection:'column', gap:10}}>
      {contacts.map(ct => (
        <div key={ct.id} style={{display:'flex', alignItems:'center', gap:12, padding:'10px 12px', background:'var(--paper-deep)', borderRadius:10}}>
          <div style={{width:36, height:36, borderRadius:'50%', background:'var(--ochre-pale)', color:'var(--ochre-deep)', display:'grid', placeItems:'center', fontFamily:'Instrument Serif', fontStyle:'italic', fontSize:16, flexShrink:0}}>{Initials(ct.name)}</div>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontWeight:600, fontSize:13.5}}>{ct.name}{ct.role ? <span style={{fontWeight:400, fontSize:11, color:'var(--ink-faint)', marginLeft:6}}>{ct.role}</span> : null}</div>
            <div style={{fontFamily:'JetBrains Mono', fontSize:11, color:'var(--ink-faint)', letterSpacing:'.08em'}}>{ct.phone || '—'}</div>
          </div>
          <div style={{display:'flex', gap:4}}>
            <button className="icon-btn" onClick={() => openSheet && openSheet('contact-edit', { student: stored, contact: ct })} aria-label="Изменить"><Icon name="edit" size={13}/></button>
            <button className="icon-btn" onClick={() => openSheet && openSheet('contact', { student: stored, contact: ct })} aria-label="Связь"><Icon name="phone" size={14}/></button>
            {contacts.length > 1 && (
              <button className="icon-btn" style={{color:'var(--berry)'}} onClick={() => removeContact(ct.id)} aria-label="Удалить">×</button>
            )}
          </div>
        </div>
      ))}
      <div style={{display:'flex', gap:8}}>
        <button className="btn btn-sm" style={{flex:1, justifyContent:'center'}} onClick={() => openSheet && openSheet('contact-edit', { student: stored, contact: null })}>
          + Добавить контакт
        </button>
        <button className="btn btn-sm" style={{flex:2, justifyContent:'center', cursor:'pointer'}} onClick={() => openSheet && openSheet('parent-mk', { student: stored })}>
          <Icon name="share" size={14}/> Карточка и PDF
        </button>
      </div>
    </div>
  );
};

const Timeline = () => (
  <div className="timeline">
    {[
      { date: '21 мая, ср', title: 'Чтение по слогам', note: 'Хорошо справилась с длинными словами — «карандаш», «велосипед».', kind: '' },
      { date: '19 мая, пн', title: 'Математика · состав числа', note: 'Состав 7 и 8 — твёрдо. Перешли к 9.', kind: '' },
      { date: '17 мая, сб', title: 'Окружающий мир', note: 'Перенос с пятницы. Тема: времена года.', kind: '' },
      { date: '14 мая, ср', title: 'Логика', note: 'Закономерности — пока сложно. Дала задание домой.', kind: '' },
      { date: '12 мая, пн', title: 'Письмо', note: 'Не пришла — болезнь. Урок засчитан как пропуск по уваж. причине.', kind: 'missed' },
      { date: '10 мая, сб', title: 'Чтение', note: 'Прочла короткий текст самостоятельно — впервые!', kind: '' },
      { date: '07 мая, ср', title: 'Математика', note: 'Урок отменён — праздник.', kind: 'canceled' },
      { date: '24 мая, сб', title: 'Запланировано: контрольное чтение', note: 'Подобрать текст на 60 слов.', kind: 'upcoming' },
    ].map((t, i) => (
      <div key={i} className={`tl-item ${t.kind}`}>
        <div className="tl-date">{t.date.toUpperCase()}</div>
        <div className="tl-title">{t.title}</div>
        <div className="tl-note">{t.note}</div>
      </div>
    ))}
  </div>
);

window.Students = Students;
window.StudentProfile = StudentProfile;

// ---- Legacy section 7 ----
// Schedule — weekly view
const Schedule = ({ goTo }) => {
  const { students, groups } = window.MK_DATA;
  const today = window.MK_DATA.today;
  const { openSheet, notify } = useApp();
  const [view, setView] = React.useState('week');     // 'day' | 'week' | 'month'
  const [weekOffset, setWeekOffset] = React.useState(0);
  const [filter, setFilter] = React.useState({ subjects: [], groups: [], showCanceled: true });
  const days = ['ПН','ВТ','СР','ЧТ','ПТ','СБ'];
  const _now = new Date();
  const _mon0 = new Date(_now); _mon0.setDate(_now.getDate() - ((_now.getDay()+6)%7));
  const _mon = new Date(_mon0); _mon.setDate(_mon0.getDate() + weekOffset * 7);
  const _wdays = Array.from({length:6}, (_, i) => { const d = new Date(_mon); d.setDate(_mon.getDate()+i); return d; });
  const nums = _wdays.map(d => String(d.getDate()).padStart(2,'0'));
  const todayIdx = weekOffset === 0 ? Math.min((_now.getDay()+6)%7, 5) : -1;
  const _mru = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
  const _weekLabel = _wdays[0].getMonth()===_wdays[5].getMonth()
    ? `${_wdays[0].getDate()} – ${_wdays[5].getDate()} ${_mru[_wdays[5].getMonth()]}`
    : `${_wdays[0].getDate()} ${_mru[_wdays[0].getMonth()]} – ${_wdays[5].getDate()} ${_mru[_wdays[5].getMonth()]}`;
  const _wnum = (() => { const d=new Date(Date.UTC(_mon.getFullYear(),_mon.getMonth(),_mon.getDate())); const dn=d.getUTCDay()||7; d.setUTCDate(d.getUTCDate()+4-dn); const y=new Date(Date.UTC(d.getUTCFullYear(),0,1)); return Math.ceil((((d-y)/86400000)+1)/7); })();
  const startHour = 9;
  const endHour = 20;
  const slotHeight = 64; // px per hour

  const hours = [];
  for (let h = startHour; h <= endHour; h++) hours.push(h);

  const blockFor = (b) => {
    let label, who;
    if (b.group) {
      const g = (groups||[]).find(g => g.id === b.groupId);
      const memberCount = (window.MK_STORE?.students||[]).filter(s=>s.groupId===b.groupId).length;
      label = g?.name || '';
      who = `${memberCount} учеников · ${g?.room||''}`;
    } else {
      const st = (students||[]).find(s => s.id === b.studentId);
      label = st?.short || st?.name || '';
      who = window.MK_STORE?.getGroupName(st?.groupId) || st?.group || '';
    }
    const top = (b.start - startHour) * slotHeight;
    const height = (b.end - b.start) * slotHeight - 4;
    const fmt = (h) => `${Math.floor(h).toString().padStart(2,'0')}:${((h%1)*60).toString().padStart(2,'0')}`;
    return { ...b, label, who, top, height, timeLabel: `${fmt(b.start)}–${fmt(b.end)}` };
  };

  const passFilter = (b) => {
    if (!filter.showCanceled && b.canceled) return false;
    if (filter.subjects.length && !filter.subjects.includes(b.subject)) return false;
    if (filter.groups.length) {
      if (b.group) return filter.groups.includes(b.groupId);
      return false;
    }
    return true;
  };

  // Now line — настоящее текущее время
  const nowHour = _now.getHours() + _now.getMinutes() / 60;
  const nowVisible = nowHour >= startHour && nowHour <= endHour;
  const nowLabel = `${String(_now.getHours()).padStart(2,'0')}:${String(_now.getMinutes()).padStart(2,'0')}`;
  const todayDayIdx = (_now.getDay() + 6) % 7; // 0=Пн … 6=Вс

  return (
    <div className="content">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div className="seg">
          <button className={view === 'day' ? 'on' : ''} onClick={() => setView('day')}>День</button>
          <button className={view === 'week' ? 'on' : ''} onClick={() => setView('week')}>Неделя</button>
          <button className={view === 'month' ? 'on' : ''} onClick={() => setView('month')}>Месяц</button>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:10}}>
          <button className="icon-btn" onClick={() => setWeekOffset(w => w - 1)} aria-label="Предыдущая неделя"><Icon name="chevronL" size={14}/></button>
          <div className="font-serif italic" style={{fontSize:22, cursor:'pointer'}} onClick={() => setWeekOffset(0)} title="Сегодня">
            {_weekLabel}
            <span style={{color:'var(--ink-faint)', fontStyle:'normal', fontFamily:'JetBrains Mono', fontSize:11, letterSpacing:'.12em'}}>
              {' '}· {_wnum} НЕДЕЛЯ
            </span>
          </div>
          <button className="icon-btn" onClick={() => setWeekOffset(w => w + 1)} aria-label="Следующая неделя"><Icon name="chevron" size={14}/></button>
          <span style={{flex:1}}></span>
          <button className="btn btn-sm" onClick={() => openSheet('filter', { value: filter, onApply: setFilter })}>
            <Icon name="filter" size={13}/> Фильтр
            {(filter.subjects.length + filter.groups.length > 0 || !filter.showCanceled) && (
              <span style={{marginLeft:6, padding:'1px 6px', borderRadius:999, background:'var(--forest)', color:'oklch(0.97 0.02 85)', fontSize:10, fontWeight:600}}>
                {filter.subjects.length + filter.groups.length + (filter.showCanceled ? 0 : 1)}
              </span>
            )}
          </button>
          <button className="btn btn-sm btn-primary" onClick={() => openSheet('record')}>
            <Icon name="plus" size={13}/> Записать урок
          </button>
        </div>
      </div>

      {view === 'month' && (() => {
        // Реальный месяц: учитываем смещение от понедельника + длину месяца + сколько надо до следующего понедельника
        const monthRef = new Date(_mon);
        // monthRef сейчас — пн отображаемой недели. Найдём 1-е число текущего месяца на основе сегодняшней даты
        // (месячный вид показывает текущий календарный месяц, не привязан к weekOffset)
        const mY = _now.getFullYear();
        const mM = _now.getMonth();
        const first = new Date(mY, mM, 1);
        const daysInMonth = new Date(mY, mM + 1, 0).getDate();
        const firstDayIdx = (first.getDay() + 6) % 7; // 0=Пн
        const totalCells = Math.ceil((firstDayIdx + daysInMonth) / 7) * 7;
        const ruMonthName = ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'][mM];
        return (
        <div className="card" style={{padding: 24}}>
          <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:14}}>
            <div className="card-tag">месячный вид</div>
            <div className="font-serif italic" style={{fontSize:18}}>{ruMonthName} {mY}</div>
          </div>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8}}>
            {['ПН','ВТ','СР','ЧТ','ПТ','СБ','ВС'].map(d => (
              <div key={d} style={{fontFamily:'JetBrains Mono', fontSize:10, letterSpacing:'.12em', color:'var(--ink-faint)', padding:'4px 0', textAlign:'center'}}>{d}</div>
            ))}
            {Array.from({length: totalCells}, (_, i) => {
              const dayNum = i - firstDayIdx + 1;
              const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
              const cellDate = inMonth ? new Date(mY, mM, dayNum) : null;
              const isToday = inMonth && dayNum === _now.getDate() && mM === _now.getMonth() && mY === _now.getFullYear();
              const lessons = inMonth ? window.MK_SCHEDULE.lessonsForDate(cellDate).filter(passFilter) : [];
              const lessonsCount = lessons.length;
              const cancelledCount = lessons.filter(l => l.canceled).length;
              return (
                <div
                  key={i}
                  onClick={() => {
                    if (!inMonth) return;
                    // Переключаем на week-view + перематываем weekOffset на эту дату
                    const monThis = new Date(cellDate);
                    monThis.setDate(cellDate.getDate() - ((cellDate.getDay() + 6) % 7));
                    const monNow = new Date(_now);
                    monNow.setDate(_now.getDate() - ((_now.getDay() + 6) % 7));
                    const diffWeeks = Math.round((monThis - monNow) / (7 * 24 * 3600 * 1000));
                    setWeekOffset(diffWeeks);
                    setView('week');
                  }}
                  style={{
                    aspectRatio: '1', display: 'flex', flexDirection: 'column',
                    padding: 8, borderRadius: 8,
                    border: '1px solid ' + (isToday ? 'var(--forest)' : 'var(--rule)'),
                    background: isToday ? 'var(--moss-pale)' : 'var(--paper-card)',
                    cursor: inMonth ? 'pointer' : 'default',
                    opacity: inMonth ? 1 : 0.25,
                    transition: 'all .12s',
                  }}
                  onMouseEnter={e => { if (inMonth && !isToday) e.currentTarget.style.background = 'var(--paper-deep)'; }}
                  onMouseLeave={e => { if (inMonth && !isToday) e.currentTarget.style.background = 'var(--paper-card)'; }}
                >
                  <span style={{fontFamily:'Instrument Serif', fontStyle:'italic', fontSize:18, color: isToday ? 'var(--forest-deep)' : 'var(--ink)'}}>
                    {inMonth ? dayNum : ''}
                  </span>
                  {lessonsCount > 0 && (
                    <span style={{fontFamily:'JetBrains Mono', fontSize:9, color:'var(--ink-faint)', marginTop:'auto', letterSpacing:'.05em'}}>
                      {lessonsCount - cancelledCount} ур.{cancelledCount > 0 ? ` · ${cancelledCount} отм.` : ''}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        );
      })()}

      {view === 'day' && (() => {
        const _dayCap = ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'][todayDayIdx];
        const _dayLow = ['понедельник','вторник','среда','четверг','пятница','суббота','воскресенье'][todayDayIdx];
        const _dayLessons = window.MK_SCHEDULE.lessonsForDate(_now).filter(passFilter);
        const _dayName = `${_dayCap} ${_now.getDate()} ${_mru[_now.getMonth()]}`;
        return (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-tag">{_dayLow} · {_now.getDate()} {_mru[_now.getMonth()]} · {_dayLessons.length} уроков</div>
              <div className="card-title">День <em>в работе</em></div>
            </div>
          </div>
          <div className="today-list">
            {_dayLessons.map((b, i) => {
              const block = blockFor(b);
              return (
                <div key={b.id || i} className="lesson-row" onClick={() => openSheet('lesson', { lesson: { ...b, dayName: _dayName } })}>
                  <div className="lesson-time">{block.timeLabel.split('–')[0]}<span className="dur">{Math.round((b.end - b.start) * 60)} МИН</span></div>
                  <div>
                    <div className="lesson-meta-line">
                      <span className="lesson-name">{block.label}</span>
                      <span className="lesson-sub">/ {b.subject}</span>
                    </div>
                    <div className="lesson-topic">{block.who}</div>
                  </div>
                  <span className={`lesson-status ${b.canceled ? 'done' : ''}`}>
                    {b.canceled ? '⋵ перенос' : 'в плане'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        );
      })()}

      {view === 'week' && (
      <div className="schedule-grid">
        <div className="sched-head">
          <div></div>
          {days.map((d, i) => (
            <div key={d} className={`day ${i === todayIdx ? 'today' : ''}`}>
              <span className="wd">{d}</span>
              <span className="dn">{nums[i]}</span>
            </div>
          ))}
        </div>

        <div className="sched-body" style={{ position:'relative', height: (endHour - startHour) * slotHeight }}>
          <div className="sched-times">
            {hours.map(h => (
              <div key={h} className="sched-time" style={{height: slotHeight}}>{h.toString().padStart(2,'0')}:00</div>
            ))}
          </div>
          {days.map((_, dIdx) => {
            const _colDate = _wdays[dIdx];
            const _colLessons = window.MK_SCHEDULE.lessonsForDate(_colDate).filter(passFilter);
            const _colDayName = `${days[dIdx]} ${_colDate.getDate()} ${_mru[_colDate.getMonth()]}`;
            return (
            <div key={dIdx} className="sched-col" style={{ height: (endHour - startHour) * slotHeight }}>
              {hours.map(h => (
                <div key={h} className="hour-line" style={{ top: (h - startHour) * slotHeight }}></div>
              ))}
              {_colLessons.map((b, i) => {
                const block = blockFor(b);
                return (
                  <div
                    key={b.id || i}
                    className={`sched-block ${block.tone || ''} ${block.group ? 'group' : ''} ${b.canceled ? 'canceled' : ''}`}
                    style={{ top: block.top, height: block.height }}
                    onClick={(e) => { e.stopPropagation(); openSheet('lesson', { lesson: { ...b, dayName: _colDayName } }); }}
                  >
                    <div className="t">{block.timeLabel}</div>
                    <div className="n">{block.label}</div>
                    <div className="topic">{b.subject}</div>
                  </div>
                );
              })}
            </div>
            );
          })}

          {weekOffset === 0 && nowVisible && <div className="sched-now" style={{ top: (nowHour - startHour) * slotHeight }}>
            <span className="sched-now-label">сейчас {nowLabel}</span>
          </div>}
        </div>
      </div>
      )}

      {/* small legend */}
      <div style={{display:'flex', gap:18, alignItems:'center', paddingLeft:6, flexWrap:'wrap'}}>
        <span className="card-tag">Палитра предметов</span>
        <span style={{display:'flex', alignItems:'center', gap:6, fontSize:12}}><span style={{width:14, height:14, background:'var(--moss-pale)', border:'1px solid oklch(0.78 0.05 145)', borderRadius:4}}></span> Чтение / язык</span>
        <span style={{display:'flex', alignItems:'center', gap:6, fontSize:12}}><span style={{width:14, height:14, background:'var(--ochre-pale)', border:'1px solid oklch(0.83 0.08 78)', borderRadius:4}}></span> Математика / логика</span>
        <span style={{display:'flex', alignItems:'center', gap:6, fontSize:12}}><span style={{width:14, height:14, background:'var(--sky-pale)', border:'1px solid oklch(0.82 0.06 225)', borderRadius:4}}></span> Письмо / окруж. мир</span>
        <span style={{display:'flex', alignItems:'center', gap:6, fontSize:12}}><span style={{width:14, height:14, background:'oklch(0.93 0.03 305)', border:'1px solid oklch(0.85 0.05 305)', borderRadius:4}}></span> Английский / речь</span>
        <span style={{display:'flex', alignItems:'center', gap:6, fontSize:12}}><span style={{width:14, height:14, background:'oklch(0.94 0.05 145)', border:'1px solid oklch(0.78 0.06 150)', borderRadius:4}}></span> ◗ Группа</span>
      </div>
    </div>
  );
};

window.Schedule = Schedule;

// ---- Legacy section 8 ----
// Attendance journal
const Attendance = () => {
  const { students, groups } = window.MK_DATA;
  const { notify } = useApp();
  const [period, setPeriod] = React.useState('2w'); // '2w' | 'month' | 'sem'
  const [groupFilter, setGroupFilter] = React.useState('all'); // 'all' | groupId
  const [, setStoreVersion] = React.useState(0);
  React.useEffect(() => {
    return window.MK_STORE.subscribe(() => setStoreVersion(v => v + 1));
  }, []);
  const [editing, setEditing] = React.useState(null); // {sid, date}

  const calcRate = (marks) => {
    const total = marks.filter(m => m !== '-').length;
    if (total === 0) return null;
    const ok = marks.filter(m => m === 'P' || m === 'L' || m === 'M').length;
    return Math.round(ok / total * 100);
  };

  const renderMark = (m) => {
    if (m === '-') return <span className="att-mark skip">·</span>;
    if (m === 'P') return <span className="att-mark present">✓</span>;
    if (m === 'L') return <span className="att-mark late">⌖</span>;
    if (m === 'A') return <span className="att-mark absent">✗</span>;
    if (m === 'M') return <span className="att-mark makeup">м</span>;
    return null;
  };

  const visibleStudents = groupFilter === 'all'
    ? students
    : students.filter(s => s.groupId === groupFilter);
  const journal = selectAttendanceJournal(
    window.MK_STORAGE_MIGRATION?.store,
    {
      studentIds: visibleStudents.map(s => s.id),
      period,
      now: new Date(),
    },
  );
  const rowsByStudent = new Map(
    journal.rows.map(row => [row.studentId, row]),
  );
  const summary = summarizeAttendance(journal.rows);

  const setMark = (student, cell, mark) => {
    const change = attendanceMarkToLegacyChange(mark);
    if (!cell.editable || !change) return;

    try {
      validateLegacyLessonStatusChange({
        store: window.MK_STORAGE_MIGRATION?.store,
        studentId: student.id,
        activeSubId: cell.activeSubId,
        lessonIndex: cell.lessonIndex,
        legacyStatus: change.status,
        note: change.note,
        changedAt: new Date().toISOString(),
      });
    } catch (error) {
      notify(error.message || 'Не удалось обновить отметку', 'err');
      return;
    }

    const updateSubscription = (subscription) => {
      const lessons = [...(subscription.lessons || [])];
      lessons[cell.lessonIndex] = {
        ...lessons[cell.lessonIndex],
        status: change.status,
        note: change.note,
      };
      const events = [...(subscription.events || []), {
        type: change.status,
        date: new Date().toLocaleDateString('ru-RU'),
        note: `Журнал: ${window.MK_LESSON_LABELS[change.status] || change.status} (${lessons[cell.lessonIndex].date})${change.note ? ` → ${change.note}` : ''}`,
      }];
      return { ...subscription, lessons, events };
    };

    if (cell.activeSubId === 'main') {
      window.MK_STORE.updateStudent(student.id, updateSubscription);
    } else {
      window.MK_STORE.updateExtraSub(
        student.id,
        cell.activeSubId,
        updateSubscription,
      );
    }
    notify('Отметка и абонемент обновлены');
  };

  return (
    <div className="content">
      <div className="attendance-table">
        <div className="att-toolbar">
          <div className="att-tabs">
            <span className={`att-tab ${period === '2w' ? 'active' : ''}`}    onClick={() => setPeriod('2w')}>2 недели</span>
            <span className={`att-tab ${period === 'month' ? 'active' : ''}`} onClick={() => setPeriod('month')}>Месяц</span>
            <span className={`att-tab ${period === 'sem' ? 'active' : ''}`}   onClick={() => setPeriod('sem')}>Семестр</span>
          </div>
          <span style={{fontFamily:'JetBrains Mono', fontSize:11, color:'var(--ink-faint)', letterSpacing:'.1em'}}>{journal.label}</span>
          <span className="grow"></span>
          <button className="btn btn-sm" onClick={() => { notify('Открываю окно печати'); setTimeout(() => window.print(), 200); }}>
            <Icon name="print" size={13}/> Печать
          </button>
          <button className="btn btn-sm" onClick={() => downloadAttendanceCSV(visibleStudents, journal)}>
            <Icon name="download" size={13}/> CSV
          </button>
        </div>

        <div className="att-group-tabs" style={{display:'flex', gap:6, flexWrap:'wrap', padding:'14px 22px', borderBottom:'1px dashed var(--rule)', minWidth:'900px'}}>
          <button
            onClick={() => setGroupFilter('all')}
            style={{
              padding:'5px 12px', borderRadius:999, fontSize:11.5, letterSpacing:'.04em', cursor:'pointer',
              border:'1px solid ' + (groupFilter === 'all' ? 'var(--forest)' : 'var(--rule)'),
              background: groupFilter === 'all' ? 'var(--forest)' : 'transparent',
              color: groupFilter === 'all' ? 'oklch(0.97 0.02 85)' : 'var(--ink-soft)',
              fontFamily:'Manrope, sans-serif', fontWeight: 500,
            }}
          >Все · {students.length}</button>
          {groups.map(g => {
            const cnt = students.filter(s => s.groupId === g.id).length;
            const on = groupFilter === g.id;
            return (
              <button
                key={g.id}
                onClick={() => setGroupFilter(g.id)}
                style={{
                  padding:'5px 12px', borderRadius:999, fontSize:11.5, letterSpacing:'.04em', cursor:'pointer',
                  border:'1px solid ' + (on ? g.color : 'var(--rule)'),
                  background: on ? g.color : 'transparent',
                  color: on ? 'oklch(0.97 0.02 85)' : 'var(--ink-soft)',
                  fontFamily:'Manrope, sans-serif', fontWeight: 500,
                  display:'flex', alignItems:'center', gap:6,
                }}
                title={g.focus}
              >
                {!on && <span style={{width:8, height:8, borderRadius:2, background:g.color, display:'inline-block'}}></span>}
                {g.name} · {cnt}
              </button>
            );
          })}
        </div>

        {journal.columns.length === 0 && (
          <div style={{padding:'28px 22px', color:'var(--ink-soft)', fontSize:13}}>
            За выбранный период нет занятий.
          </div>
        )}

        <div className="att-grid" style={{
          gridTemplateColumns: journal.columns.length
            ? `180px repeat(${journal.columns.length}, 1fr) 120px`
            : '180px 120px',
        }}>
          {/* header row */}
          <div className="att-h name">УЧЕНИК</div>
          {journal.columns.map(column => (
            <div key={column.date} className="att-h">{column.day}<span className="wd">{column.weekday}</span></div>
          ))}
          <div className="att-h">ПОСЕЩАЕМОСТЬ</div>

          {visibleStudents.map(s => {
            const row = rowsByStudent.get(s.id) || { cells: [] };
            const studentMarks = row.cells.map(cell => cell.mark);
            const rate = calcRate(studentMarks);
            return (
              <React.Fragment key={s.id}>
                <div className="att-name">
                  <div className="av" style={{color: s.spine}}>{Initials(s.name)}</div>
                  <div>
                    <div>{s.short}</div>
                    <div style={{fontFamily:'JetBrains Mono', fontSize:9.5, color:'var(--ink-faint)', letterSpacing:'.1em', textTransform:'uppercase'}}>{window.MK_STORE.getGroupName(s.groupId) || s.group || ''}</div>
                  </div>
                </div>
                {row.cells.map((cell) => (
                  <div
                    key={cell.date}
                    className={`att-cell ${editing && editing.sid === s.id && editing.date === cell.date ? 'editing' : ''}`}
                    style={{position: 'relative', cursor: cell.editable ? 'pointer' : 'default'}}
                    title={cell.editable ? 'Изменить статус занятия' : 'В этот день занятия не было'}
                    role={cell.editable ? 'button' : undefined}
                    tabIndex={cell.editable ? 0 : undefined}
                    aria-label={cell.editable ? `${s.name}, ${cell.date}: изменить статус занятия` : undefined}
                    data-attendance-cell={`${s.id}:${cell.date}`}
                    onClick={(e) => {
                      if (!cell.editable) return;
                      e.stopPropagation();
                      setEditing({ sid: s.id, date: cell.date });
                    }}
                    onKeyDown={(e) => {
                      if (!cell.editable || !['Enter', ' '].includes(e.key)) return;
                      e.preventDefault();
                      setEditing({ sid: s.id, date: cell.date });
                    }}
                  >
                    {renderMark(cell.mark)}
                    {editing && editing.sid === s.id && editing.date === cell.date && (
                      <MarkPicker
                        onPick={(mark) => setMark(s, cell, mark)}
                        onClose={() => setEditing(null)}
                      />
                    )}
                  </div>
                ))}
                <div className="att-rate">
                  {rate !== null ? (
                    <>
                      <span>{rate}%</span>
                      <div className="ring" style={{ '--p': rate }}><span>{rate}</span></div>
                    </>
                  ) : (
                    <span style={{color:'var(--ink-faint)'}}>—</span>
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </div>

        <div className="att-legend">
          <span>Условные обозначения:</span>
          <span className="item"><span className="att-mark present" style={{fontSize:11}}>✓</span> присутствовал</span>
          <span className="item"><span className="att-mark late" style={{fontSize:11}}>⌖</span> опоздал</span>
          <span className="item"><span className="att-mark absent" style={{fontSize:11}}>✗</span> пропуск</span>
          <span className="item"><span className="att-mark makeup" style={{fontSize:9}}>м</span> отработка</span>
          <span className="item"><span className="att-mark skip" style={{fontSize:9}}>·</span> урок не назначен</span>
        </div>
      </div>

      {/* summary stats row */}
      <div className="dash-grid">
        <div className="stat">
          <div className="stat-label">Средняя посещаемость</div>
          <div className="stat-num">{summary.rate ?? '—'}{summary.rate !== null && <small>%</small>}</div>
          <div className="stat-foot">по занятиям выбранного периода</div>
        </div>
        <div className="stat">
          <div className="stat-label">Пропусков</div>
          <div className="stat-num">{summary.absences}</div>
          <div className="stat-foot">болезнь и отсутствие</div>
        </div>
        <div className="stat">
          <div className="stat-label">Отработок проведено</div>
          <div className="stat-num">{summary.makeups}</div>
          <div className="stat-foot">отмечено в журнале</div>
        </div>
        <div className="stat">
          <div className="stat-label">Опозданий</div>
          <div className="stat-num">{summary.late}</div>
          <div className="stat-foot">за выбранный период</div>
        </div>
      </div>
    </div>
  );
};

window.Attendance = Attendance;

function downloadAttendanceCSV(students, journal) {
  const journalRows = new Map(
    journal.rows.map(row => [row.studentId, row]),
  );
  const rows = [[
    'Ученик',
    'Группа',
    ...journal.columns.map(column => column.exportLabel),
    'Посещаемость %',
  ]];
  students.forEach(s => {
    const m = (journalRows.get(s.id)?.cells || []).map(cell => cell.mark);
    const total = m.filter(x => x !== '-').length;
    const ok = m.filter(x => x === 'P' || x === 'L' || x === 'M').length;
    const rate = total ? Math.round(ok / total * 100) : '';
    rows.push([
      s.name,
      window.MK_STORE.getGroupName(s.groupId) || s.group || '',
      ...m,
      rate,
    ]);
  });
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `посещаемость-${journal.label.toLowerCase().replace(/\s+/g,'-')}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---- Legacy section 9 ----
// Groups
const Groups = () => {
  const { groups, students } = window.MK_DATA;
  const { openSheet } = useApp();

  return (
    <div className="content">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div style={{display:'flex', gap:18, alignItems:'baseline'}}>
          <span style={{fontFamily:'JetBrains Mono', fontSize:11, color:'var(--ink-faint)', letterSpacing:'.14em', textTransform:'uppercase'}}>
            всего {groups.length} групп · {students.length} учеников
          </span>
        </div>
        <div style={{display:'flex', gap:8}}>
          <button className="btn btn-sm" onClick={() => openSheet('archive')}><Icon name="archive" size={13}/> Архив</button>
          <button className="btn btn-sm btn-primary" onClick={() => openSheet('group', { mode: 'new' })}><Icon name="plus" size={13}/> Новая группа</button>
        </div>
      </div>

      <div className="groups-grid">
        {groups.map(g => {
          const roster = students.filter(s => s.groupId === g.id);
          const shown = roster.slice(0, 4);
          const rest = roster.length - shown.length;
          return (
            <div key={g.id} className="group-card" style={{ '--bookspine': g.color }} onClick={() => openSheet('group', { mode: 'detail', group: g })}>
              <div className="ribbon">{g.tag}</div>
              <h3>{g.name.split(' ')[0]} <em>{g.name.split(' ').slice(1).join(' ')}</em></h3>
              <div className="group-meta">{g.age} · {g.focus}</div>

              <div className="group-stats">
                <div className="s"><span className="n">{roster.length}</span><span className="l">учеников</span></div>
                <div className="s"><span className="n">{g.schedule.length}</span><span className="l">{g.schedule.length === 1 ? 'занятие в нед.' : 'занятий в нед.'}</span></div>
                <div className="s"><span className="n font-serif italic">{g.room}</span><span className="l">кабинет</span></div>
              </div>

              <div className="group-roster">
                <div className="roster-avs">
                  {shown.map((s, i) => (
                    <div key={s.id} className="av" style={{ color: s.spine }}>{Initials(s.name)}</div>
                  ))}
                  {rest > 0 && <div className="more">+{rest}</div>}
                </div>
              </div>

              <div className="group-times">
                {g.schedule.map((t, i) => (
                  <span key={i} className={`time-chip ${i === 0 ? 'hot' : ''}`}>{t}</span>
                ))}
              </div>

              <div style={{marginTop:18, display:'flex', gap:8, justifyContent:'flex-end'}}>
                <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); openSheet('group', { mode: 'detail', group: g }); }}>Открыть</button>
                <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); openSheet('group', { mode: 'edit', group: g }); }}>Редактировать</button>
              </div>
            </div>
          );
        })}

        {/* CTA card */}
        <div className="group-card" onClick={() => openSheet('group', { mode: 'new' })} style={{ border: '1.5px dashed var(--rule)', background: 'transparent', boxShadow:'none', display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center', minHeight: 280, cursor: 'pointer' }}>
          <div style={{width:56, height:56, borderRadius:'50%', border:'1.5px dashed var(--rule)', display:'grid', placeItems:'center', color:'var(--ink-faint)'}}>
            <Icon name="plus" size={22}/>
          </div>
          <div className="font-serif" style={{fontSize:22, marginTop:14}}>Создать <em style={{color:'var(--forest)'}}>группу</em></div>
          <div style={{fontSize:12.5, color:'var(--ink-faint)', marginTop:6, textAlign:'center', maxWidth: 220}}>
            Подберите учеников по возрасту, добавьте расписание и тему — программа подскажет совпадения по времени.
          </div>
        </div>
      </div>
    </div>
  );
};

window.Groups = Groups;

// ---- Legacy section 10 ----
// ── Payments report ──
const PaymentsReportSheet = ({ onClose }) => {
  const { students } = window.MK_DATA;
  const [period, setPeriod] = React.useState('current'); // 'current' | 'prev' | 'all'
  const _now = new Date();
  const _mru = ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
  const _mruShort = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];

  // Собираем все события type:payment с парсингом даты и суммы
  const events = [];
  for (const s of students) {
    for (const e of (s.events || [])) {
      if (e.type !== 'payment' && e.type !== 'payment-pending') continue;
      const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(e.date || '');
      if (!m) continue;
      const day = parseInt(m[1], 10);
      const month = parseInt(m[2], 10) - 1;
      const year = parseInt(m[3], 10);
      const rub = (e.note || '').match(/([\d\s ]+)\s*₽/);
      const amount = rub ? parseInt(rub[1].replace(/[\s ]/g, ''), 10) : (s.price || 0);
      events.push({
        studentName: s.name,
        studentId: s.id,
        spine: s.spine,
        date: { day, month, year, sortKey: year * 10000 + month * 100 + day },
        dateStr: e.date,
        note: e.note,
        amount,
        pending: e.type === 'payment-pending',
      });
    }
  }
  events.sort((a, b) => b.date.sortKey - a.date.sortKey);

  const periodFiltered = period === 'all'
    ? events
    : events.filter(e => {
        if (period === 'current') return e.date.month === _now.getMonth() && e.date.year === _now.getFullYear();
        // prev
        const pm = _now.getMonth() === 0 ? 11 : _now.getMonth() - 1;
        const py = _now.getMonth() === 0 ? _now.getFullYear() - 1 : _now.getFullYear();
        return e.date.month === pm && e.date.year === py;
      });

  const totalSum = periodFiltered.filter(e => !e.pending).reduce((a, e) => a + e.amount, 0);
  const pendingSum = periodFiltered.filter(e => e.pending).reduce((a, e) => a + e.amount, 0);

  const periodLabel = period === 'current'
    ? _mru[_now.getMonth()] + ' ' + _now.getFullYear()
    : period === 'prev'
    ? _mru[(_now.getMonth() + 11) % 12] + ' ' + (_now.getMonth() === 0 ? _now.getFullYear() - 1 : _now.getFullYear())
    : 'всё время';

  return (
    <Sheet
      eyebrow="отчёт · поступления"
      title="Поступления"
      titleEm={periodLabel}
      onClose={onClose}
      foot={<button className="btn btn-sm" onClick={onClose}>Готово</button>}
    >
      <div style={{display:'flex', gap:6, marginBottom:18}}>
        <button onClick={() => setPeriod('current')}
          className={`choice ${period === 'current' ? 'on' : ''}`}>Текущий месяц</button>
        <button onClick={() => setPeriod('prev')}
          className={`choice ${period === 'prev' ? 'on' : ''}`}>Предыдущий</button>
        <button onClick={() => setPeriod('all')}
          className={`choice ${period === 'all' ? 'on' : ''}`}>Всё время</button>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:18}}>
        <div style={{padding:'14px 16px', background:'var(--moss-pale)', borderRadius:10}}>
          <div style={{fontFamily:'JetBrains Mono', fontSize:10, letterSpacing:'.14em', textTransform:'uppercase', color:'var(--ink-faint)'}}>Получено</div>
          <div className="font-serif" style={{fontSize:28, color:'var(--forest)', marginTop:4}}>
            {totalSum.toLocaleString('ru-RU')} <small style={{fontSize:14}}>₽</small>
          </div>
        </div>
        <div style={{padding:'14px 16px', background:'var(--ochre-pale)', borderRadius:10}}>
          <div style={{fontFamily:'JetBrains Mono', fontSize:10, letterSpacing:'.14em', textTransform:'uppercase', color:'var(--ink-faint)'}}>Ожидается</div>
          <div className="font-serif" style={{fontSize:28, color:'var(--ochre-deep)', marginTop:4}}>
            {pendingSum.toLocaleString('ru-RU')} <small style={{fontSize:14}}>₽</small>
          </div>
        </div>
      </div>

      <div style={{display:'flex', flexDirection:'column', gap:0}}>
        {periodFiltered.length === 0 ? (
          <div className="font-serif italic" style={{fontSize:15, color:'var(--ink-faint)', padding:'14px 0'}}>
            Платежей в этом периоде ещё не было.
          </div>
        ) : periodFiltered.map((e, i) => (
          <div key={i} style={{display:'grid', gridTemplateColumns:'auto 1fr auto auto', gap:14, padding:'12px 0', borderTop: i ? '1px dashed var(--rule)' : 'none', alignItems:'center'}}>
            <div className="font-serif italic" style={{fontSize:16, color:'var(--ink)', minWidth:75}}>
              {String(e.date.day).padStart(2,'0')} {_mruShort[e.date.month]}
            </div>
            <div>
              <div style={{fontWeight:600, fontSize:13.5}}>{e.studentName}</div>
              <div style={{fontFamily:'JetBrains Mono', fontSize:10, color:'var(--ink-faint)', letterSpacing:'.06em', marginTop:2}}>
                {e.note}
              </div>
            </div>
            <div className="font-mono" style={{fontSize:13, fontWeight:600}}>{e.amount.toLocaleString('ru-RU')} ₽</div>
            <span className="pill" style={{
              fontSize:10, padding:'2px 8px',
              background: e.pending ? 'var(--ochre-pale)' : 'var(--moss-pale)',
              color: e.pending ? 'var(--ochre-deep)' : 'var(--forest)',
            }}>{e.pending ? 'ждёт' : 'оплачен'}</span>
          </div>
        ))}
      </div>
    </Sheet>
  );
};

// ── Parent Pick Sheet ──
const ParentPickSheet = ({ onClose, notify }) => {
  const { students } = window.MK_DATA;
  const { openSheet } = useApp();
  const [q, setQ] = React.useState('');
  const filtered = students.filter(s => s.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <Sheet
      eyebrow="выберите ученика"
      title="Карточка"
      titleEm="родителя"
      onClose={onClose}
    >
      <div className="fld" style={{marginBottom:14}}>
        <input
          placeholder="Найти ученика…"
          value={q}
          onChange={e => setQ(e.target.value)}
          autoFocus
        />
      </div>
      <div className="search-results">
        {filtered.map(s => (
          <div key={s.id} className="search-row" onClick={() => {
            onClose();
            setTimeout(() => openSheet('parent-mk', { student: s }), 100);
          }}>
            <div className="av" style={{color: s.spine}}>{Initials(s.name)}</div>
            <div style={{flex:1}}>
              <div className="what">{s.name}</div>
              <div className="where">{getAge(s) != null ? `${getAge(s)} лет · ` : ''}{window.MK_STORE.getGroupName(s.groupId) || s.group || ''}</div>
            </div>
            <Icon name="parent" size={14}/>
          </div>
        ))}
      </div>
    </Sheet>
  );
};

// ── Parent Card Modal ──
const ParentCardMk = ({ student: s, onClose, notify }) => {
  const card = selectParentCardData({
    store: window.MK_STORAGE_MIGRATION?.store,
    legacyStudent: window.MK_STORE.getStudent(s.id) || s,
    legacyGroups: window.MK_STORE.groups,
    legacyEvents: s.events || [],
  });
  const sub = card.subscription;
  const left = card.remaining;
  const evs = card.events.slice(0,4);
  const groupName = card.groupName;
  const [publishing, setPublishing] = React.useState(false);
  const currentStudent = window.MK_STORE.getStudent(s.id) || s;
  const hasPublishedLink = Boolean(currentStudent.parentAccessToken);

  const printCard = () => {
    notify('Откроется печать — выберите «Сохранить как PDF»', 'ok');
    document.body.classList.add('print-parent-card');
    const cleanup = () => document.body.classList.remove('print-parent-card');
    window.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(() => {
      window.print();
      setTimeout(cleanup, 500);
    }, 50);
  };

  const copyParentLink = async () => {
    if (!FIREBASE_RUNTIME.enabled) {
      notify('Публичные ссылки доступны после подключения Firebase', 'err');
      return;
    }
    setPublishing(true);
    try {
      let token = (window.MK_STORE.getStudent(s.id) || s).parentAccessToken;
      if (!token) {
        token = createParentAccessToken();
        window.MK_STORE.updateStudent(s.id, { parentAccessToken: token });
      }
      const publicCard = buildPublicCardForStudent(
        window.MK_STORE.getStudent(s.id) || s,
      );
      await publishPublicParentCard({
        firebaseConfig: FIREBASE_RUNTIME.firebase,
        token,
        card: publicCard,
        waitForAccess: () =>
          window.MK_FIREBASE_AUTH.waitForAuthorizedUser(),
      });
      const url = new URL(window.location.href);
      url.search = '';
      url.hash = '';
      url.searchParams.set('card', token);
      await navigator.clipboard.writeText(url.toString());
      notify('Ссылка для родителей скопирована', 'ok');
    } catch (error) {
      notify(error.message || 'Не удалось создать ссылку', 'err');
    } finally {
      setPublishing(false);
    }
  };

  const revokeParentLink = async () => {
    const token = (window.MK_STORE.getStudent(s.id) || s).parentAccessToken;
    if (!token) return;
    const confirmed = window.confirm(
      'Отозвать ссылку? Старая ссылка у родителей перестанет открываться.',
    );
    if (!confirmed) return;
    setPublishing(true);
    try {
      await revokePublicParentCard({
        firebaseConfig: FIREBASE_RUNTIME.firebase,
        token,
        waitForAccess: () =>
          window.MK_FIREBASE_AUTH.waitForAuthorizedUser(),
      });
      window.MK_STORE.updateStudent(s.id, { parentAccessToken: null });
      notify('Ссылка отозвана', 'ok');
    } catch (error) {
      notify(error.message || 'Не удалось отозвать ссылку', 'err');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Sheet
      eyebrow="карточка ученика · только просмотр"
      title={s.name.split(' ')[0]}
      titleEm={s.name.split(' ').slice(1).join(' ')}
      onClose={onClose}
      foot={<>
        <button className="btn btn-sm" onClick={onClose}>Закрыть</button>
        <span className="grow"></span>
        <button
          className="btn btn-sm"
          onClick={copyParentLink}
          disabled={publishing}
        >
          <Icon name="share" size={13}/>
          {publishing ? 'Публикуем…' : 'Скопировать ссылку'}
        </button>
        {hasPublishedLink && (
          <button
            className="btn btn-sm btn-danger-ghost"
            onClick={revokeParentLink}
            disabled={publishing}
          >
            <Icon name="x" size={13}/> Отозвать
          </button>
        )}
        <button className="btn btn-sm btn-primary" onClick={printCard}>
          <Icon name="share" size={13}/> Сохранить в PDF
        </button>
      </>}
    >
      <div className="parent-card" style={{'--bookspine': s.spine||'#1F3A2E'}}>
        <div className="perf"></div>
        <div className="parent-header">
          <div className="parent-brand">Енот<em>Помогун</em><small>карточка ученика · только просмотр</small></div>
          <div className="parent-stamp">{left>0?'активна':'завершена'}<br/>пакет {left}/{sub.totalSessions}</div>
        </div>
        <div className="parent-name-row">
          <div className="parent-av">{Initials(s.name)}</div>
          <div>
            <div className="parent-name">{s.name.split(' ')[0]} <em>{s.name.split(' ').slice(1).join(' ')}</em></div>
            <div className="parent-sub">{getAge(s) != null ? `${getAge(s)} лет · ` : ''}{groupName}</div>
          </div>
        </div>

        <div className="parent-section">
          <h4>Абонемент на занятия</h4>
          <div className="parent-pack">
            <div>
              <div className="big"><em>{left}</em><small>/{sub.totalSessions}</small></div>
              <div style={{fontFamily:'JetBrains Mono',fontSize:10,letterSpacing:'.12em',color:'var(--ink-faint)',textTransform:'uppercase',marginTop:4}}>занятий осталось</div>
            </div>
            <div className="right">
              <div className="l">оплачено</div>
              <div className="d">{sub.paid||'—'}</div>
              <div className="l" style={{marginTop:10}}>стоимость</div>
              <div className="d" style={{color: left<=2?'var(--ochre-deep)':'inherit'}}>{(sub.price||0).toLocaleString('ru')} ₽</div>
            </div>
          </div>
          <div className="parent-stamps">
            {sub.lessons.map((l,i)=>{
              const rot = `${(i*37)%17-8}deg`;
              if(l.status==='done') return <div key={i} className="stamp used" style={{'--rot':rot}}>✓</div>;
              if(l.status==='future' && i===sub.lessons.findIndex(x=>x.status==='future')) return <div key={i} className="stamp next">{l.date}</div>;
              if(['transfer','sick','sick-wait'].includes(l.status)) return <div key={i} className="stamp" style={{borderColor:'var(--ochre)',color:'var(--ochre-deep)',fontSize:9}}>↪</div>;
              if(l.status==='freeze') return <div key={i} className="stamp" style={{borderColor:'var(--sky)',color:'var(--sky)',fontSize:9}}>❄</div>;
              return <div key={i} className="stamp"></div>;
            })}
          </div>
          {left<=2 && left>0 && <div style={{marginTop:12,padding:'10px 12px',background:'var(--ochre-pale)',borderRadius:8,fontSize:12.5,color:'var(--ochre-deep)',display:'flex',gap:8,alignItems:'center'}}>
            <span className="font-serif italic" style={{fontSize:16}}>⌛</span>
            Абонемент заканчивается — осталось {left} занятий. Свяжитесь с педагогом для продления.
          </div>}
        </div>

        {(sub.freezeUsed||0)>0 && <div className="parent-section">
          <h4>Заморозка</h4>
          <div style={{display:'flex',alignItems:'center',gap:8,fontFamily:'JetBrains Mono',fontSize:12}}>
            <span>Использовано {sub.freezeUsed} из {sub.freezeMax||3} недель</span>
            <div style={{display:'flex',gap:4,marginLeft:'auto'}}>
              {Array.from({length:sub.freezeMax||3},(_,i)=><div key={i} style={{width:10,height:10,borderRadius:'50%',background:i<(sub.freezeUsed||0)?'oklch(0.52 0.1 230)':'var(--rule)'}}></div>)}
            </div>
          </div>
        </div>}

        {evs.length>0 && <div className="parent-section">
          <h4>Последние события</h4>
          {evs.map((e,i)=>{
            const dc=e.type==='payment'?'var(--forest)':e.type==='freeze'?'oklch(0.52 0.1 230)':e.type==='refund'?'var(--berry)':'var(--ochre)';
            return <div key={i} style={{display:'flex',gap:10,padding:'8px 0',borderTop:i?'1px dashed var(--rule)':'none',alignItems:'flex-start'}}>
              <div style={{width:7,height:7,borderRadius:'50%',background:dc,flexShrink:0,marginTop:4}}></div>
              <div style={{flex:1,fontSize:13}}>{e.note}</div>
              <div style={{fontFamily:'JetBrains Mono',fontSize:10,color:'var(--ink-faint)'}}>{e.date}</div>
            </div>;
          })}
        </div>}

        <div className="parent-footer">обновлено {new Date().toLocaleDateString('ru-RU')}</div>
      </div>
    </Sheet>
  );
};

// Main App Shell
const { useState, useEffect } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "forest",
  "showStamps": true,
  "density": "comfortable",
  "headerStyle": "serif"
}/*EDITMODE-END*/;

const ACCENTS = {
  forest:   { name:'Лесной', forest:'oklch(0.34 0.062 152)', deep:'oklch(0.26 0.055 152)', soft:'oklch(0.55 0.055 152)', moss:'oklch(0.78 0.05 145)', mossPale:'oklch(0.92 0.035 140)' },
  bordeaux: { name:'Бордо',   forest:'oklch(0.36 0.10 22)',  deep:'oklch(0.28 0.09 22)',   soft:'oklch(0.55 0.10 22)',  moss:'oklch(0.78 0.08 25)',  mossPale:'oklch(0.93 0.04 25)' },
  ink:      { name:'Чернила', forest:'oklch(0.28 0.04 250)', deep:'oklch(0.22 0.035 250)', soft:'oklch(0.5 0.05 250)',  moss:'oklch(0.78 0.06 245)', mossPale:'oklch(0.93 0.03 245)' },
};

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { console.error('[ErrorBoundary]', err, info); }
  reset = () => this.setState({ err: null });
  render() {
    if (this.state.err) {
      return (
        <div className="content">
          <div className="card" style={{padding: 32, textAlign: 'center'}}>
            <div className="card-tag" style={{color: 'var(--berry)', marginBottom: 8}}>что-то сломалось</div>
            <div className="font-serif italic" style={{fontSize: 28, marginBottom: 14}}>Этот экран <em>не загрузился</em></div>
            <div style={{fontFamily: 'JetBrains Mono', fontSize: 11, color: 'var(--ink-faint)', marginBottom: 18, wordBreak: 'break-word'}}>
              {String(this.state.err.message || this.state.err)}
            </div>
            <button className="btn btn-sm" onClick={this.reset}>Попробовать снова</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const VALID_ROUTES = ['dashboard', 'students', 'schedule', 'attendance', 'groups'];
const _readHash = () => {
  const parts = (window.location.hash || '').replace(/^#\/?/, '').split('/');
  const r = VALID_ROUTES.includes(parts[0]) ? parts[0] : 'dashboard';
  const sel = parts[1] || null;
  return { route: r, selected: sel };
};

// ── Standalone parent view (открывается по ?parent=sid) ──
const ParentStandalone = ({ student, publicCard = null }) => {
  const legacyStudent = publicCard
    ? student
    : window.MK_STORE.getStudent(student.id) || student;
  const card = selectParentCardData({
    store: publicCard ? null : window.MK_STORAGE_MIGRATION?.store,
    legacyStudent,
    legacyGroups: publicCard
      ? [{ id: 'public', name: publicCard.student.group }]
      : window.MK_STORE.groups,
    legacyEvents: legacyStudent.events || [],
  });
  const sub = card.subscription;
  const lessons = sub.lessons || [];
  const left = card.remaining;
  const total = card.total;
  const groupName = publicCard?.student?.group || card.groupName;
  const teacherName = publicCard
    ? (publicCard.teacher?.name || '').trim()
    : (window.MK_PROFILE.data.name || '').trim();
  const paymentUrl = publicCard
    ? (publicCard.teacher?.paymentUrl || '').trim()
    : (window.MK_PROFILE.data.paymentUrl || '').trim();

  // Дата следующей оплаты — последнее занятие в пакете
  const futureLessons = lessons.filter(l => l.status === 'future' || l.status === 'sick-wait');
  const nextPayDate = futureLessons.length > 0 ? futureLessons[futureLessons.length - 1].date : null;

  const stampStyle = { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2 };
  const dateSpan = (date) => date
    ? <span style={{fontSize:9, fontFamily:"'JetBrains Mono',monospace", fontStyle:'normal', opacity:.85, lineHeight:1, letterSpacing:'-.01em'}}>{date.slice(0,5)}</span>
    : null;

  return (
    <div style={{minHeight:'100vh', background:'var(--paper)', padding:'40px 20px'}}>
      <div style={{maxWidth: 560, margin: '0 auto'}}>
        <div style={{textAlign:'center', marginBottom:24}}>
          <div className="font-serif" style={{fontSize:24, color:'var(--forest)'}}>
            {teacherName || 'Педагог'}
          </div>
          <div style={{fontFamily:'JetBrains Mono', fontSize:10, letterSpacing:'.18em', color:'var(--ink-faint)', textTransform:'uppercase', marginTop:4}}>
            карточка ученика · только просмотр
          </div>
        </div>

        <div className="parent-card" style={{'--bookspine': student.spine || '#1F3A2E'}}>
          <div className="perf"></div>
          <div className="parent-header">
            <div className="parent-brand">{teacherName || 'Педагог'}<small>карточка ученика</small></div>
            <div className="parent-stamp">{left>0?'активна':'завершена'}<br/>пакет {left}/{total}</div>
          </div>
          <div className="parent-name-row">
            <div className="parent-av">{(student.name||'').split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase()}</div>
            <div style={{display:'flex', flexDirection:'column', justifyContent:'center', gap:6}}>
              <div className="parent-name">{student.name.split(' ')[0]} <em>{student.name.split(' ').slice(1).join(' ')}</em></div>
              {groupName && <div className="parent-sub" style={{marginTop:0}}>{groupName}</div>}
            </div>
          </div>

          <div className="parent-section">
            <h4>Абонемент на занятия</h4>
            <div className="parent-pack">
              <div>
                <div className="big"><em>{left}</em><small>/{total}</small></div>
                <div style={{fontFamily:'JetBrains Mono',fontSize:10,letterSpacing:'.12em',color:'var(--ink-faint)',textTransform:'uppercase',marginTop:4}}>занятий осталось</div>
              </div>
              <div className="right">
                <div className="l">оплачено</div>
                <div className="d">{sub.paid || student.paid || '—'}</div>
                <div className="l" style={{marginTop:10}}>стоимость</div>
                <div className="d">{(sub.price || student.price || 0).toLocaleString('ru')} ₽</div>
              </div>
            </div>
            <div className="parent-stamps">
              {lessons.map((l, i) => {
                if (l.status === 'done') return (
                  <div key={i} className="stamp used" style={stampStyle}>
                    <span style={{fontSize:12}}>✓</span>
                    {dateSpan(l.date)}
                  </div>
                );
                if (l.status === 'freeze') return (
                  <div key={i} className="stamp" style={{...stampStyle, borderColor:'var(--sky)', color:'var(--sky)'}}>
                    <span style={{fontSize:10}}>❄</span>
                    {dateSpan(l.date)}
                  </div>
                );
                if (['transfer','sick','sick-wait'].includes(l.status)) return (
                  <div key={i} className="stamp" style={{...stampStyle, borderColor:'var(--ochre)', color:'var(--ochre-deep)'}}>
                    <span style={{fontSize:10}}>↪</span>
                    {dateSpan(l.date)}
                  </div>
                );
                return (
                  <div key={i} className="stamp next" style={stampStyle}>
                    {dateSpan(l.date)}
                  </div>
                );
              })}
            </div>
            {nextPayDate && <div style={{marginTop:14, padding:'10px 14px', borderRadius:8, fontSize:13, color:'oklch(0.4 0.18 20)', fontWeight:500, background:'oklch(0.97 0.03 20)', border:'1px solid oklch(0.87 0.09 20)', display:'flex', alignItems:'center', gap:8}}>
              <span style={{fontSize:16}}>🗓</span>
              <span>Следующий платёж — <strong>{nextPayDate}</strong></span>
            </div>}
            {left <= 2 && left > 0 && <div style={{marginTop:8, padding:'10px 12px', background:'var(--ochre-pale)', borderRadius:8, fontSize:12.5, color:'var(--ochre-deep)'}}>
              ⌛ Абонемент заканчивается — осталось {left} занятий.
            </div>}
          </div>

          {paymentUrl && <div className="parent-section">
            <h4>Оплата</h4>
            <div style={{textAlign:'center'}}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(paymentUrl)}`}
                alt="QR для оплаты"
                width={180} height={180}
                style={{borderRadius:12, border:'1px solid var(--rule)', display:'block', margin:'0 auto 14px'}}
              />
              <a
                href={paymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{display:'inline-block', padding:'10px 22px', background:'var(--forest)', color:'#fff', borderRadius:8, fontFamily:"'JetBrains Mono',monospace", fontSize:12, letterSpacing:'.08em', textDecoration:'none', textTransform:'uppercase'}}
              >
                Оплатить онлайн
              </a>
              <div style={{marginTop:10, fontSize:11, color:'var(--ink-faint)'}}>
                Отсканируйте QR камерой банковского приложения<br/>или нажмите кнопку выше
              </div>
            </div>
          </div>}

          <div className="parent-footer">обновлено {new Date().toLocaleDateString('ru-RU')}</div>
        </div>

        <div style={{textAlign:'center', marginTop:24, fontFamily:'JetBrains Mono', fontSize:10, letterSpacing:'.14em', color:'var(--ink-faint)', textTransform:'uppercase'}}>
          по вопросам — обратитесь к педагогу
        </div>
      </div>
    </div>
  );
};

const _readParentParam = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('parent');
  } catch { return null; }
};

const _readParentCardToken = () => {
  try {
    return new URLSearchParams(window.location.search).get('card');
  } catch { return null; }
};

const PublicParentRoute = ({ token }) => {
  const [state, setState] = React.useState({
    loading: true,
    card: null,
    error: null,
  });

  React.useEffect(() => {
    let active = true;
    readPublicParentCard({
      firebaseConfig: FIREBASE_RUNTIME.firebase,
      token,
    })
      .then((card) => {
        if (active) setState({ loading: false, card, error: null });
      })
      .catch((error) => {
        if (active) setState({ loading: false, card: null, error });
      });
    return () => { active = false; };
  }, [token]);

  if (state.loading) {
    return (
      <div className="public-card-state">
        <div className="sync-dot"></div>
        Загружаем карточку
      </div>
    );
  }
  const student = publicCardToLegacyStudent(state.card);
  if (!student) {
    return (
      <div className="public-card-state error">
        <div className="font-serif italic">Карточка не найдена</div>
        <span>Ссылка могла устареть. Уточните её у педагога.</span>
      </div>
    );
  }
  return <ParentStandalone student={student} publicCard={state.card} />;
};

const App = () => {
  const publicToken = _readParentCardToken();
  if (publicToken) return <PublicParentRoute token={publicToken} />;
  // Если открыта ссылка ?parent=sid — показываем минимальный standalone-вид без интерфейса учителя
  const _parentSid = _readParentParam();
  if (_parentSid) {
    const studentForParent = window.MK_STORE.getStudent(_parentSid);
    if (studentForParent) return <ParentStandalone student={studentForParent} />;
    return (
      <div style={{minHeight:'100vh', display:'grid', placeItems:'center', background:'var(--paper)', padding:20, textAlign:'center'}}>
        <div>
          <div className="font-serif italic" style={{fontSize:28, marginBottom:10}}>Карточка не найдена</div>
          <div style={{color:'var(--ink-faint)'}}>Возможно ссылка устарела. Уточните у педагога.</div>
        </div>
      </div>
    );
  }

  const _initial = _readHash();
  const [route, setRoute] = useState(_initial.route);
  const [selectedStudent, setSelectedStudent] = useState(_initial.selected || 's1');
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [toasts, setToasts] = useState([]);
  const [sheet, setSheet] = useState(null);   // { kind, props }
  const [syncStatus, setSyncStatus] = useState(
    window.MK_SYNC_STATUS.value,
  );
  const [, _rerender] = React.useReducer(x => x + 1, 0);
  useEffect(() => {
    const u1 = window.MK_STORE.subscribe(_rerender);
    const u2 = window.MK_SCHEDULE.subscribe(_rerender);
    const u3 = window.MK_PROFILE.subscribe(_rerender);
    const u4 = window.MK_ALERTS.subscribe(_rerender);
    const u5 = window.MK_SYNC_STATUS.subscribe(setSyncStatus);
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, []);

  // route/selected → URL hash
  const _firstMount = React.useRef(true);
  useEffect(() => {
    const target = route === 'students' && selectedStudent
      ? `${route}/${selectedStudent}`
      : route;
    const cur = (window.location.hash || '').replace(/^#\/?/, '');
    if (cur !== target) {
      // первый запуск — replace (не плодим лишнюю запись поверх внешней),
      // дальше pushState — чтобы «назад» в браузере ходил между экранами проекта,
      // а не вылетал на Vercel/GitHub
      if (_firstMount.current) history.replaceState(null, '', `#${target}`);
      else history.pushState(null, '', `#${target}`);
    }
    _firstMount.current = false;
  }, [route, selectedStudent]);

  // URL hash → route/selected (кнопки «назад»/«вперёд» в браузере)
  useEffect(() => {
    const onHash = () => {
      const h = _readHash();
      setRoute(h.route);
      if (h.selected) setSelectedStudent(h.selected);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const notify = React.useCallback((msg, tone = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, msg, tone }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2600);
  }, []);

  const openSheet = React.useCallback((kind, props = {}) => setSheet({ kind, props }), []);
  const closeSheet = React.useCallback(() => setSheet(null), []);

  // apply accent
  useEffect(() => {
    const a = ACCENTS[t.accent] || ACCENTS.forest;
    const root = document.documentElement;
    root.style.setProperty('--forest', a.forest);
    root.style.setProperty('--forest-deep', a.deep);
    root.style.setProperty('--forest-soft', a.soft);
    root.style.setProperty('--moss', a.moss);
    root.style.setProperty('--moss-pale', a.mossPale);
  }, [t.accent]);

  useEffect(() => {
    document.body.classList.toggle('headers-sans', t.headerStyle === 'sans');
  }, [t.headerStyle]);

  useEffect(() => {
    document.body.classList.toggle('no-stamps', !t.showStamps);
  }, [t.showStamps]);

  const _t = window.MK_DATA.today;
  const _allStudents = window.MK_STORE.students;
  const _allGroups = window.MK_STORE.groups;
  const _activeStudents = _allStudents.filter(s => s.status === 'active').length;
  const _wdCap = _t.weekday;
  const _wkNum = (() => { const d=new Date(); const u=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())); const dn=u.getUTCDay()||7; u.setUTCDate(u.getUTCDate()+4-dn); const y=new Date(Date.UTC(u.getUTCFullYear(),0,1)); return Math.ceil((((u-y)/86400000)+1)/7); })();
  const _attEnd = new Date(); const _attStart = new Date(_attEnd); _attStart.setDate(_attEnd.getDate()-13);
  const _mru = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
  const _attLabel = _attStart.getMonth()===_attEnd.getMonth()
    ? `${_attStart.getDate()} – ${_attEnd.getDate()} ${_mru[_attEnd.getMonth()]} ${_attEnd.getFullYear()}`
    : `${_attStart.getDate()} ${_mru[_attStart.getMonth()]} – ${_attEnd.getDate()} ${_mru[_attEnd.getMonth()]} ${_attEnd.getFullYear()}`;
  const _grpSizes = _allGroups.map(g => _allStudents.filter(s => s.groupId === g.id).length);
  const _grpMin = _grpSizes.length ? Math.min(..._grpSizes) : 0;
  const _grpMax = _grpSizes.length ? Math.max(..._grpSizes) : 0;
  const titles = {
    dashboard:  { eyebrow: `${_wdCap} · ${_t.date} ${_t.month} ${_t.year}`, h1: ['Здравствуйте,', window.MK_PROFILE.data.name] },
    students:   { eyebrow: `${_allStudents.length} учеников · ${_allGroups.length} групп`, h1: ['Мой', 'класс'] },
    schedule:   { eyebrow: `Неделя ${_wkNum} · ${_t.month} ${_t.year}`,    h1: ['Учительский', 'ежедневник'] },
    attendance: { eyebrow: `Период · ${_attLabel}`,                         h1: ['Журнал', 'посещаемости'] },
    groups:     { eyebrow: `${_allGroups.length} групп · от ${_grpMin} до ${_grpMax} человек`, h1: ['Учебные', 'группы'] },
  };

  const top = titles[route] || titles.dashboard;
  const syncView = {
    initializing: ['Подготовка', 'neutral'],
    local: ['Только локально', 'neutral'],
    connecting: ['Подключение', 'busy'],
    'waiting-for-remote': ['Ожидание облака', 'busy'],
    syncing: ['Сохраняю', 'busy'],
    connected: ['Сохранено', 'ok'],
    conflict: ['Обновлено из облака', 'warn'],
    error: ['Ошибка синхронизации', 'error'],
  }[syncStatus.state] || ['Синхронизация', 'neutral'];
  const syncTitle = syncStatus.error?.message ||
    (syncStatus.savedAt
      ? `Последнее сохранение: ${new Date(syncStatus.savedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
      : syncView[0]);
  const Screen = {
    dashboard: window.Dashboard || Dashboard,
    students: window.Students || (() => <div>Загрузка...</div>),
    schedule: window.Schedule || (() => <div>Загрузка...</div>),
    attendance: window.Attendance || (() => <div>Загрузка...</div>),
    groups: window.Groups || (() => <div>Загрузка...</div>),
  }[route];

  const navItems = [
    { id: 'dashboard',  label: 'Панель',         icon: 'dashboard' },
    { id: 'students',   label: 'Ученики',        icon: 'students' },
    { id: 'schedule',   label: 'Расписание',     icon: 'schedule' },
    { id: 'attendance', label: 'Посещаемость',   icon: 'attendance' },
    { id: 'groups',     label: 'Группы',         icon: 'groups' },
  ];

  // Sheet kind → component
  const renderSheet = () => {
    if (!sheet) return null;
    const { kind, props } = sheet;
    const close = closeSheet;
    const common = { onClose: close, notify, goTo: setRoute, setSelectedStudent };
    switch (kind) {
      case 'record':    return <RecordLessonSheet  {...common} {...props} />;
      case 'lesson':    return <LessonDetailSheet  {...common} {...props} />;
      case 'contact':   return <ContactSheet       {...common} {...props} />;
      case 'renew':         return <RenewModal              {...common} {...props} />;
      case 'renew-extra':   return <RenewExtraSubModal      {...common} {...props} />;
      case 'add-sub':       return <AddExtraSubModal        {...common} {...props} />;
      case 'add-individual':return <AddIndividualLessonModal {...common} {...props} />;
      case 'contact-edit':  return <ContactEditModal        {...common} {...props} />;
      case 'alert':     return <AlertModal         {...common} {...props} />;
      case 'notif':     return <NotifSheet         {...common} {...props} />;
      case 'search':    return <SearchSheet        {...common} {...props} />;
      case 'filter':    return <FilterSheet        {...common} {...props} />;
      case 'group':     return <GroupSheet         {...common} {...props} />;
      case 'archive':   return <ArchiveSheet       {...common} {...props} />;
      case 'settings':  return <SettingsSheet      {...common} {...props} />;
      case 'parent-mk': return <ParentCardMk       {...common} {...props} />;
      case 'parent-pick': return <ParentPickSheet  {...common} {...props} />;
      case 'payments-report': return <PaymentsReportSheet {...common} {...props} />;
      case 'student-new': return <StudentNewSheet {...common} {...props} />;
      default: return null;
    }
  };

  return (
    <AppProvider value={{ openSheet, closeSheet, notify, goTo: setRoute, setSelectedStudent }}>
      <div className="app">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark">Е</div>
            <div>
              <div className="brand-name">Енот<em>Помогун</em></div>
              <div className="brand-sub">учительский ежедневник</div>
            </div>
          </div>

          <div className="nav">
            <div className="nav-section">Работа</div>
            {navItems.map(n => (
              <div
                key={n.id}
                className={`nav-item ${route === n.id ? 'active' : ''}`}
                onClick={() => setRoute(n.id)}
                data-screen-label={`${n.label}`}
              >
                <Icon name={n.icon} />
                <span className="label">{n.label}</span>
                {n.badge && <span className="badge">{n.badge}</span>}
              </div>
            ))}

            <div className="nav-section">Делиться</div>
            <div className="nav-item" onClick={() => openSheet('parent-pick')} style={{cursor:'pointer'}}>
              <Icon name="parent" />
              <span className="label">Карточка родителя</span>
            </div>

            <div className="nav-section">Прочее</div>
            <div className="nav-item" onClick={() => openSheet('archive')}>
              <Icon name="archive" /><span className="label">Архив пакетов</span>
            </div>
            <div className="nav-item" onClick={() => openSheet('settings')}>
              <Icon name="settings" /><span className="label">Настройки</span>
            </div>
          </div>

          <div className="sidebar-footer">
            <div className="avatar">{(window.MK_PROFILE.data.name || '').split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()}</div>
            <div>
              <div className="user-name">{window.MK_PROFILE.data.name}</div>
              <div className="user-role">{window.MK_PROFILE.data.role}</div>
            </div>
          </div>
        </aside>

        <main className="main">
          <div className="topbar" data-screen-label={`Топ · ${top.h1.join(' ')}`}>
            <div className="topbar-title">
              <div className="topbar-meta">{top.eyebrow}</div>
              <h1>{top.h1[0]}<br/><em>{top.h1[1]}</em></h1>
            </div>
            <div className="topbar-actions">
              <div
                className={`sync-chip ${syncView[1]}`}
                title={syncTitle}
                aria-live="polite"
              >
                <span className="sync-dot"></span>
                <span>{syncView[0]}</span>
              </div>
              <button className="icon-btn" onClick={() => openSheet('search')} aria-label="Поиск">
                <Icon name="search" size={15}/>
              </button>
              <button className="icon-btn" onClick={() => openSheet('notif')} aria-label="Оповещения" style={{position:'relative'}}>
                <Icon name="bell" size={15}/>
                {window.MK_ALERTS.unreadCount > 0 && (
                  <span style={{
                    position:'absolute', top:2, right:2, minWidth:14, height:14, padding:'0 4px',
                    borderRadius:7, background:'var(--berry)', color:'oklch(0.97 0.02 85)',
                    fontFamily:'JetBrains Mono', fontSize:9, fontWeight:600,
                    display:'grid', placeItems:'center', lineHeight:1,
                  }}>{window.MK_ALERTS.unreadCount}</span>
                )}
              </button>
              <button className="btn" onClick={() => openSheet('record')}>
                <Icon name="plus" size={13}/> Записать урок
              </button>
              {window.MK_FIREBASE_AUTH && (
                <button
                  className="icon-btn logout-btn"
                  onClick={() => window.MK_FIREBASE_AUTH.signOut()}
                  aria-label="Выйти из аккаунта"
                  title="Выйти из аккаунта"
                >
                  <Icon name="logout" size={15}/>
                </button>
              )}
            </div>
          </div>

          <ErrorBoundary key={route}>
            <Screen
              goTo={setRoute}
              selectedId={selectedStudent}
              setSelectedId={setSelectedStudent}
            />
          </ErrorBoundary>
        </main>

        <TweaksPanel title="Tweaks">
          <TweakSection label="Акцент">
            <TweakColor
              label="Сигнатурный цвет"
              value={t.accent === 'forest' ? '#1F3A2E' : t.accent === 'bordeaux' ? '#6B2A2A' : '#2C2D4F'}
              onChange={(v) => {
                const k = v === '#1F3A2E' ? 'forest' : v === '#6B2A2A' ? 'bordeaux' : 'ink';
                setTweak('accent', k);
              }}
              options={['#1F3A2E', '#6B2A2A', '#2C2D4F']}
            />
          </TweakSection>

          <TweakSection label="Заголовки">
            <TweakRadio
              label="Стиль"
              value={t.headerStyle}
              onChange={v => setTweak('headerStyle', v)}
              options={[{value:'serif', label:'Антиква'}, {value:'sans', label:'Гротеск'}]}
            />
          </TweakSection>

          <TweakSection label="Карточка ученика">
            <TweakToggle label="Показывать штампы посещений" value={t.showStamps} onChange={v => setTweak('showStamps', v)} />
          </TweakSection>
        </TweaksPanel>

        {renderSheet()}

        <div className="toast-stack">
          {toasts.map(tt => (
            <div key={tt.id} className="toast">
              <span className="toast-dot"></span>
              <span>{tt.msg}</span>
            </div>
          ))}
        </div>
      </div>
    </AppProvider>
  );
};

const rootElement = document.getElementById('root');
window.__MK_REACT_ROOT__ =
  window.__MK_REACT_ROOT__ || ReactDOM.createRoot(rootElement);

const formatAuthError = (error) => {
  const message = String(error || '');
  if (message.includes('auth/operation-not-allowed')) {
    return 'В Firebase ещё не включён вход через Google.';
  }
  if (message.includes('auth/popup-closed-by-user')) {
    return 'Окно входа было закрыто. Можно попробовать ещё раз.';
  }
  if (message.includes('auth/popup-blocked')) {
    return 'Браузер заблокировал окно входа. Разрешите всплывающие окна.';
  }
  if (message.includes('auth/unauthorized-domain')) {
    return 'Этот адрес не разрешён в Firebase. Откройте приложение через localhost.';
  }
  return message;
};

const FirebaseAuthGate = ({ children }) => {
  const controller = window.MK_FIREBASE_AUTH;
  const [authState, setAuthState] = React.useState(
    controller?.state || { status: 'authorized', user: null, error: null },
  );

  React.useEffect(
    () => controller?.subscribe(setAuthState),
    [controller],
  );

  if (!controller || _readParentParam() || _readParentCardToken()) {
    return children;
  }
  if (authState.status === 'authorized') return children;

  const isLoading = authState.status === 'loading';
  const error = formatAuthError(authState.error);

  return (
    <main className="auth-gate" data-auth-status={authState.status}>
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand">
          <span className="auth-brand-mark">Е</span>
          <span>Енот<em>Помогун</em></span>
        </div>
        <div className="auth-kicker">Личный кабинет педагога</div>
        <h1 id="auth-title">Добро пожаловать<br/><em>в ЕнотПомогун</em></h1>
        <p>
          Расписание, абонементы и прогресс учеников хранятся в защищённом
          кабинете.
        </p>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <button
          className="auth-button"
          type="button"
          disabled={isLoading}
          onClick={() => controller.signIn()}
        >
          <span className="auth-google">G</span>
          {isLoading ? 'Проверяем доступ…' : 'Войти через Google'}
        </button>
        <div className="auth-account">
          Разрешённые аккаунты<br/>
          {FIREBASE_RUNTIME.allowedEmails.map((email) => (
            <strong key={email}>{email}<br/></strong>
          ))}
        </div>
      </section>
      <aside className="auth-quote" aria-hidden="true">
        <div className="auth-orbit auth-orbit-one"></div>
        <div className="auth-orbit auth-orbit-two"></div>
        <blockquote>
          «Каждый урок — маленький шаг<br/>к большой уверенности»
        </blockquote>
        <span>Учительский ежедневник</span>
      </aside>
    </main>
  );
};

window.__MK_REACT_ROOT__.render(
  <FirebaseAuthGate>
    <App />
  </FirebaseAuthGate>,
);
