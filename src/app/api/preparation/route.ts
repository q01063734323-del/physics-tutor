import { preparationAccess } from "@/lib/command-center/access";
import { summarizeAttempts, topicAnalytics, numberAnalytics, type LearningAttempt } from "@/lib/command-center/analytics";
import { displayTrainerAnswer } from "@/lib/trainer-bank";
import { publishedTrainerById, publishedTrainerCatalog, trainerHistoryCatalog } from "@/lib/published-trainer-server";
function reply(data: object, status = 200) { return Response.json(data, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } }); }
export async function GET(request: Request) {
  try {
    const access = await preparationAccess(request, new URL(request.url).searchParams.get("student"));
    if (new URL(request.url).searchParams.get("view") === "students") {
      if (!access.teacher) return reply({ error: "Нет доступа." }, 403);
      const links = await access.db.collection("teacherStudents").where("teacherId", "==", access.user.uid).limit(200).get();
      const ids = [...new Set(links.docs.filter(link=>link.get("status")===undefined || link.get("status")==="active").map(link => link.get("studentId")))].filter((id): id is string => typeof id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(id));
      const profiles = ids.length ? await access.db.getAll(...ids.map(id => access.db.doc(`users/${id}`))) : [];
      const summaries=ids.length?await access.db.getAll(...ids.map(id=>access.db.doc(`preparationSummaries/${id}`))):[];
      return reply({ students: profiles.flatMap(profile => { const data = profile.data(); return data?.role === "student" && data.status === "active" ? [{ id: profile.id, name: String(data.displayName || "Ученик"), lastActivity: summaries.find(summary=>summary.id===profile.id)?.get("lastActivity") || null }] : []; }) });
    }
    const [records, settings] = await Promise.all([
      access.db.collection("preparationAttempts").where("studentId", "==", access.target).limit(5001).get(),
      access.db.doc(`preparationProfiles/${access.target}`).get(),
    ]);
    if (records.size > 5000) return reply({ error: "История требует постраничной загрузки. Полный расчёт временно недоступен." }, 422);
    const attempts = records.docs.map(record => {
      const attempt = record.data() as LearningAttempt; const task=publishedTrainerById.get(attempt.taskId);
      return {...attempt,reviewAnswer:attempt.evaluationStatus==="evaluated" && task?.version===attempt.taskVersion ? displayTrainerAnswer(task.answer) : null};
    });
    const exams = await access.db.collection("examAttempts").where("userId", "==", access.target).limit(100).get();
    const examHistory = exams.docs.map(record => { const data = record.data(); return { id: record.id, kind: data.kind || "legacy", mode: data.mode || "Учебная тренировка", score: typeof data.score === "number" ? data.score : null, total: typeof data.total === "number" ? data.total : null, finishedAt: data.finishedAt || null, fullEge: false }; });
    const assignmentsSnapshot = await access.db.collection("assignments").where("assignedToId", "==", access.target).limit(200).get();
    const assignments = assignmentsSnapshot.docs.map(record => { const data = record.data(); return { id: record.id, title: String(data.title || "Домашнее задание"), topic: String(data.topic || ""), due: String(data.due || ""), status: String(data.status || "new") }; });
    const fullExamsSnapshot = await access.db.collection("preparationExams").where("studentId", "==", access.target).limit(200).get();
    const fullExams = fullExamsSnapshot.docs.map(record => ({...record.data(),id:record.id}));
    const tasks = publishedTrainerCatalog.map(task => ({ id: task.id, version: task.version, section: task.section, topics: task.topics, examNumber: task.examNumber }));
    const historyCatalog = trainerHistoryCatalog(attempts);
    return reply({ tasks, assignments, fullExams, pendingAttempts: attempts.filter(attempt => attempt.evaluationStatus === "pending" && publishedTrainerById.get(attempt.taskId)?.version === attempt.taskVersion), examHistory, studentId: access.target, profile: settings.data() || null, summary: summarizeAttempts(historyCatalog, attempts), topics: topicAnalytics(historyCatalog, attempts), numbers: numberAnalytics(historyCatalog, attempts), forecast: { status: "unavailable", reason: "Нет подтверждённых полноценных пробников и валидированной модели прогноза." }, calculatedAt: new Date().toISOString(), calculationVersion: "command-center-1" });
  } catch (error) { const code = error instanceof SyntaxError ? 400 : error instanceof Error ? Number(error.message) : 0; return reply({ error: code === 403 ? "Нет доступа к аналитике ученика." : code === 401 ? "Войди в аккаунт." : "Аналитика временно недоступна. Данные не заменены нулями." }, [400,401,403].includes(code) ? code : 503); }
}

export async function POST(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return reply({ error: "Запрос отклонён." }, 403);
  try {
    const text = await request.text();
    if (text.length > 4096) return reply({ error: "Запрос слишком большой." }, 413);
    const data = JSON.parse(text);
    if (!data || !["attemptId","taskId","version","answer"].every(key => typeof data[key] === "string")) return reply({ error: "Некорректная попытка." }, 400);
    const { recordPreparationAttempt } = await import("@/lib/command-center/record-attempt");
    return reply(await recordPreparationAttempt(request, data));
  } catch (error) { const status = error instanceof SyntaxError ? 400 : error instanceof Error ? Number(error.message) : 0; return reply({ error: "Попытка не сохранена в облаке. Сохрани локальный результат и повтори отправку." }, [400,401,403,409].includes(status) ? status : 503); }
}

export async function PUT(request: Request) {
  try {
    if (request.headers.get("sec-fetch-site") === "cross-site") return reply({ error: "Запрос отклонён." }, 403);
    const access = await preparationAccess(request, new URL(request.url).searchParams.get("student"));
    const raw = await request.text(); if (raw.length > 4096) return reply({ error: "Слишком большой запрос." }, 413);
    const data = JSON.parse(raw);
    const { validPreparationProfile } = await import("@/lib/command-center/analytics");
    if (!validPreparationProfile(data)) return reply({ error: "Проверь цель, год и дату экзамена." }, 400);
    const profile = { studentId: access.target, targetScore: data.targetScore, examYear: data.examYear, examDate: data.examDate, dateSource: access.teacher ? "teacher" : "student", updatedAt: new Date().toISOString() };
    await access.db.doc(`preparationProfiles/${access.target}`).set(profile, { merge: true });
    return reply({ profile });
  } catch (error) { const code = error instanceof SyntaxError ? 400 : error instanceof Error ? Number(error.message) : 0; return reply({ error: "Не удалось сохранить настройки." }, [400,401,403].includes(code) ? code : 503); }
}

export async function PATCH(request: Request) {
  try {
    if (request.headers.get("sec-fetch-site") === "cross-site") return reply({error:"Запрос отклонён."},403);
    const access=await preparationAccess(request,new URL(request.url).searchParams.get("student"));
    if(!access.teacher || access.target===access.user.uid)return reply({error:"Выберите своего ученика."},403);
    const text=await request.text();if(text.length>4096)return reply({error:"Слишком большой запрос."},413);
    const input=JSON.parse(text);
    if(!input || typeof input!=="object" || Array.isArray(input))return reply({error:"Ожидается объект JSON."},400);
    if(input.action==="recommendation") {
      const topics=new Set(publishedTrainerCatalog.flatMap(task=>task.topics));
      if(typeof input.note!=="string" || input.note.length>1200 || !Array.isArray(input.topics) || input.topics.length>10 || input.topics.some((topic:unknown)=>typeof topic!=="string" || !topics.has(topic)))return reply({error:"Проверьте рекомендацию."},400);
      await access.db.doc(`preparationProfiles/${access.target}`).set({teacherNote:input.note,priorityTopics:input.topics,teacherId:access.user.uid,updatedAt:new Date().toISOString()},{merge:true});return reply({saved:true});
    }
    if (input.action === "grade-attempt") {
      if (typeof input.attemptId !== "string" || !/^[a-f0-9-]{36}$/.test(input.attemptId) || typeof input.correct !== "boolean") return reply({error:"Проверьте результат ручной проверки."},400);
      const ref = access.db.doc(`preparationAttempts/${access.target}_${input.attemptId}`);
      await access.db.runTransaction(async transaction => {
        const record = await transaction.get(ref);
        if (!record.exists || record.get("studentId") !== access.target) throw Error("403");
        if (publishedTrainerById.get(record.get("taskId"))?.version !== record.get("taskVersion")) throw Error("409");
        if (record.get("evaluationStatus") !== "pending") {
          if (record.get("checkingMethod") === "teacher-review-v1" && record.get("correct") === input.correct) return;
          throw Error("409");
        }
        transaction.set(ref, {...record.data(), correct:input.correct, evaluationStatus:"evaluated", checkingMethod:"teacher-review-v1", reviewedBy:access.user.uid, reviewedAt:new Date().toISOString()});
      });
      return reply({saved:true});
    }
    if(input.action==="grade-exam") {
      if(typeof input.examId!=="string" || !input.examId.startsWith(access.target+"_") || input.examId.includes("/") || !Number.isInteger(input.primaryScore) || (input.testScore!==null && (!Number.isInteger(input.testScore) || input.testScore<0 || input.testScore>100)) || typeof input.gradingSource!=="string" || !input.gradingSource.trim() || input.gradingSource.length>500)return reply({error:"Проверьте результат проверки."},400);
      const ref=access.db.doc(`preparationExams/${input.examId}`);const exam=await ref.get();
      if(!exam.exists || exam.get("studentId")!==access.target)return reply({error:"Пробник не найден."},404);
      if(input.primaryScore<0 || input.primaryScore>exam.get("maxPrimary"))return reply({error:"Первичный балл вне диапазона."},400);
      await ref.update({primaryScore:input.primaryScore,testScore:input.testScore,gradingSource:input.gradingSource,status:"reviewed",reviewedBy:access.user.uid,reviewedAt:new Date().toISOString()});return reply({saved:true});
    }
    if(input.action==="exam") {
      const e=input.exam;
      if(!e || typeof e.id!=="string" || !/^[a-f0-9-]{36}$/.test(e.id) || !Number.isInteger(e.examYear) || e.examYear<2026 || e.examYear>2040 || typeof e.variant!=="string" || !e.variant.trim() || e.variant.length>200 || !["pending","reviewed"].includes(e.status) || !Number.isInteger(e.primaryScore) || !Number.isInteger(e.maxPrimary) || e.maxPrimary<1 || e.maxPrimary>200 || e.primaryScore<0 || e.primaryScore>e.maxPrimary || (e.testScore!==null && (!Number.isInteger(e.testScore) || e.testScore<0 || e.testScore>100)) || typeof e.gradingSource!=="string" || e.gradingSource.length>500 || !e.gradingSource.trim() || typeof e.completedAt!=="string" || !Number.isFinite(Date.parse(e.completedAt)) || Date.parse(e.completedAt)>Date.now())return reply({error:"Проверьте баллы, источник оценивания и дату полного пробника."},400);
      if(e.status==="pending" && e.testScore!==null)return reply({error:"До завершения проверки тестовый балл не фиксируется."},400);
      const ref=access.db.doc(`preparationExams/${access.target}_${e.id}`);
      await access.db.runTransaction(async transaction=>{const existing=await transaction.get(ref);if(existing.exists)return;transaction.create(ref,{studentId:access.target,examYear:e.examYear,variant:e.variant,status:e.status,primaryScore:e.primaryScore,maxPrimary:e.maxPrimary,testScore:e.testScore,completedAt:e.completedAt,gradingSource:e.gradingSource,fullFormat:true,recordedBy:access.user.uid,recordedAt:new Date().toISOString()});});return reply({saved:true});
    }
    const labels=["formula","calculation","units","condition","solution","other"];
    if(input.action!=="classify" || typeof input.attemptId!=="string" || !/^[a-f0-9-]{36}$/.test(input.attemptId) || !labels.includes(input.label))return reply({error:"Некорректная классификация."},400);
    const ref=access.db.doc(`preparationAttempts/${access.target}_${input.attemptId}`);const attempt=await ref.get();
    if(!attempt.exists || attempt.get("studentId")!==access.target)return reply({error:"Попытка недоступна."},404);
    await ref.update({teacherErrorClass:input.label,classifiedBy:access.user.uid,classifiedAt:new Date().toISOString()});return reply({saved:true});
  }catch(error){const code=error instanceof SyntaxError?400:error instanceof Error?Number(error.message):0;return reply({error:"Изменение не сохранено."},[400,401,403,409].includes(code)?code:503);}
}
