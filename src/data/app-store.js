function activateQueue(subscription, targetDays) {
  const queued = subscription.queuedPack;
  const days = targetDays?.length ? targetDays : [1, 3, 5];
  const lessons = [];
  const date = new Date(`${queued.startDate}T00:00:00`);
  let guard = 0;

  while (lessons.length < queued.packSize && guard < 400) {
    if (days.includes(date.getDay())) {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      lessons.push({ date: `${day}.${month}`, status: 'future', note: '' });
    }
    date.setDate(date.getDate() + 1);
    guard += 1;
  }

  const archived = (subscription.lessons || []).filter((lesson) =>
    ['done', 'absent'].includes(lesson.status),
  );

  return {
    ...subscription,
    lessons,
    pack: queued.packSize,
    used: 0,
    status: 'active',
    archivedLessons: [
      ...(subscription.archivedLessons || []),
      ...archived,
    ],
    events: [...(subscription.events || []), ...(queued.events || [])],
    ...(queued.paid ? { paid: queued.paid } : {}),
    queuedPack: null,
  };
}

function syncSubscription(subscription, days) {
  if (!subscription?.lessons) return subscription;
  const used = subscription.lessons.filter((lesson) =>
    lesson && ['done', 'absent'].includes(lesson.status),
  ).length;
  let result = { ...subscription, used };

  if (
    result.queuedPack &&
    !result.lessons.some((lesson) =>
      ['future', 'sick-wait'].includes(lesson.status),
    )
  ) {
    result = activateQueue(result, days);
  }

  return result;
}

function syncStudent(student) {
  if (!student?.lessons) return student;
  let result = syncSubscription(student, student.days);
  if (result.extraSubs?.length) {
    result = {
      ...result,
      extraSubs: result.extraSubs.map((subscription) =>
        syncSubscription(subscription, subscription.days),
      ),
    };
  }
  return result;
}

export function createAppStore({
  repository,
  seed,
  legacyScheduleOverrides = {},
  legacyTeacherProfile = {},
  onCommit = () => {},
  onExternalChange = () => {},
  createId = () => Date.now(),
}) {
  if (!repository) throw new Error('repository is required');
  const normalizeTeacherProfile = (profile) => ({
    ...structuredClone(legacyTeacherProfile),
    ...(profile || {}),
  });

  let data = repository.getSnapshot();
  const isInitializedDocument = data?.initialized === true;
  if (!data || (!isInitializedDocument && !Array.isArray(data.students))) {
    const seeded = structuredClone(seed);
    data = {
      ...seeded,
      initialized: true,
      students: seeded.students.map(syncStudent),
      scheduleOverrides: structuredClone(legacyScheduleOverrides),
      teacherProfile: normalizeTeacherProfile(seeded.teacherProfile),
    };
  } else {
    data = {
      ...data,
      initialized: true,
      students: (data.students || []).map(syncStudent),
      groups: data.groups || [],
      scheduleOverrides:
        data.scheduleOverrides || structuredClone(legacyScheduleOverrides),
      teacherProfile: normalizeTeacherProfile(data.teacherProfile),
    };
  }
  repository.save(data);

  const subscribers = new Set();
  const emit = () => {
    subscribers.forEach((subscriber) => {
      try {
        subscriber();
      } catch (error) {
        console.error(error);
      }
    });
  };
  const commit = () => {
    repository.save(data);
    onCommit(data);
    emit();
  };
  const unsubscribeRepository = repository.subscribe?.((snapshot) => {
    if (
      !snapshot ||
      (!snapshot.initialized && !Array.isArray(snapshot.students)) ||
      !Array.isArray(snapshot.groups)
    ) {
      return;
    }
    data = {
      ...snapshot,
      initialized: true,
      students: (snapshot.students || []).map(syncStudent),
      scheduleOverrides: snapshot.scheduleOverrides || {},
      teacherProfile: normalizeTeacherProfile(snapshot.teacherProfile),
    };
    onExternalChange(data);
    emit();
  });

  const store = {
    get students() {
      return data.students;
    },
    get groups() {
      return data.groups;
    },
    get scheduleOverrides() {
      return data.scheduleOverrides || {};
    },
    get teacherProfile() {
      return data.teacherProfile || {};
    },

    subscribe(subscriber) {
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },
    destroy() {
      unsubscribeRepository?.();
      subscribers.clear();
    },

    setStudents(students) {
      data.students = students.map(syncStudent);
      commit();
    },
    updateStudent(id, updater) {
      data.students = data.students.map((student) => {
        if (student.id !== id) return student;
        const next =
          typeof updater === 'function'
            ? updater({ ...student })
            : { ...student, ...updater };
        return syncStudent(next);
      });
      commit();
    },
    addStudent(student) {
      data.students = [...data.students, syncStudent(student)];
      commit();
    },
    removeStudent(id) {
      data.students = data.students.filter((student) => student.id !== id);
      commit();
    },

    addExtraSub(studentId, subscription) {
      store.updateStudent(studentId, (student) => ({
        ...student,
        extraSubs: [
          ...(student.extraSubs || []),
          {
            ...subscription,
            id: `esub_${createId()}`,
            used: 0,
            events: [],
            archivedLessons: [],
            queuedPack: null,
          },
        ],
      }));
    },
    updateExtraSub(studentId, subscriptionId, updater) {
      store.updateStudent(studentId, (student) => ({
        ...student,
        extraSubs: (student.extraSubs || []).map((subscription) =>
          subscription.id !== subscriptionId
            ? subscription
            : typeof updater === 'function'
              ? updater({ ...subscription })
              : { ...subscription, ...updater },
        ),
      }));
    },
    removeExtraSub(studentId, subscriptionId) {
      store.updateStudent(studentId, (student) => ({
        ...student,
        extraSubs: (student.extraSubs || []).filter(
          (subscription) => subscription.id !== subscriptionId,
        ),
      }));
    },

    addIndividualLesson(studentId, lesson) {
      store.updateStudent(studentId, (student) => ({
        ...student,
        individualLessons: [
          ...(student.individualLessons || []),
          { ...lesson, id: `il_${createId()}` },
        ],
      }));
    },
    updateIndividualLesson(studentId, lessonId, updater) {
      store.updateStudent(studentId, (student) => ({
        ...student,
        individualLessons: (student.individualLessons || []).map((lesson) =>
          lesson.id !== lessonId
            ? lesson
            : typeof updater === 'function'
              ? updater({ ...lesson })
              : { ...lesson, ...updater },
        ),
      }));
    },
    removeIndividualLesson(studentId, lessonId) {
      store.updateStudent(studentId, (student) => ({
        ...student,
        individualLessons: (student.individualLessons || []).filter(
          (lesson) => lesson.id !== lessonId,
        ),
      }));
    },

    setGroups(groups) {
      data.groups = groups;
      commit();
    },
    updateGroup(id, update) {
      data.groups = data.groups.map((group) =>
        group.id === id ? { ...group, ...update } : group,
      );
      commit();
    },
    addGroup(group) {
      data.groups = [...data.groups, group];
      commit();
    },
    removeGroup(id) {
      data.groups = data.groups.filter((group) => group.id !== id);
      commit();
    },
    setScheduleOverrides(overrides) {
      data.scheduleOverrides = overrides || {};
      commit();
    },
    updateScheduleOverrides(updater) {
      const current = data.scheduleOverrides || {};
      data.scheduleOverrides =
        typeof updater === 'function'
          ? updater(structuredClone(current))
          : { ...current, ...updater };
      commit();
    },
    updateTeacherProfile(patch) {
      data.teacherProfile = {
        ...(data.teacherProfile || {}),
        ...patch,
      };
      commit();
    },
    replaceDocument(snapshot) {
      if (!snapshot?.students || !snapshot?.groups) {
        throw new Error('Invalid application document');
      }
      data = {
        ...structuredClone(snapshot),
        initialized: true,
        students: snapshot.students.map(syncStudent),
        scheduleOverrides: snapshot.scheduleOverrides || {},
        teacherProfile: normalizeTeacherProfile(snapshot.teacherProfile),
      };
      commit();
    },

    getStudent(id) {
      return data.students.find((student) => student.id === id);
    },
    getGroup(id) {
      return data.groups.find((group) => group.id === id);
    },
    getGroupName(id) {
      return data.groups.find((group) => group.id === id)?.name || '';
    },
    getGroupStudents(groupId) {
      return data.students.filter((student) => student.groupId === groupId);
    },
  };

  return store;
}
