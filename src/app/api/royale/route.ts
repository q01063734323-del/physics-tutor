import{preparationAccess}from'@/lib/command-center/access';
import{publishedTrainerQuestions,publishedTrainerById,publishedTrainerVersion}from'@/lib/published-trainer-server';
import{publicTrainerQuestion,checkPublishedAnswer,trainerOriginAllowed}from'@/lib/trainer-public';
import{defaultSettings}from'@/lib/royale/config';
import{suitableTask,taskTier,normalizeUnitInput}from'@/lib/royale/tasks';
import{normalizeProfile}from'@/lib/royale/progress';
import{RoyaleError,settingsFor,startMatch,issueQuestion,answerQuestion,finishMatch,updateCollection,teacherSettings,royaleTopics,activeMatch,abandonMatch}from'@/lib/royale/server';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};const reply=(data:object,status=200)=>Response.json(data,{status,headers});
function fail(error:unknown){const status=error instanceof RoyaleError?error.status:error instanceof SyntaxError?400:error instanceof Error&&[400,401,403,409].includes(Number(error.message))?Number(error.message):503;return reply({error:error instanceof RoyaleError?error.message:status===401?'Войдите в аккаунт.':status===403?'Нет доступа к этим данным.':status===400?'Некорректный запрос.':'Сервер игры временно недоступен. Проверьте соединение и повторите отправку.'},status);}
export async function GET(request:Request){try{const p=new URL(request.url).searchParams;
 if(p.get('view')==='catalog')return reply({version:publishedTrainerVersion,topics:royaleTopics,questions:publishedTrainerQuestions.filter(suitableTask).map(q=>({...publicTrainerQuestion(q),gameTier:taskTier(q,defaultSettings)}))});
 if(p.get('view')==='active')return reply(await activeMatch(request));
 const access=await preparationAccess(request,p.get('student')),settings=await settingsFor(access.db),profile=normalizeProfile((await access.db.doc(`royaleProfiles/${access.target}`).get()).data());
 if(p.get('view')==='teacher'){if(!access.teacher)throw new RoyaleError('Нет доступа.',403);return reply({role:'teacher',settings,profile,studentId:access.target});}
 const personal={...settings,studentTopics:{[access.target]:settings.studentTopics[access.target]||[]},studentDifficulty:settings.studentDifficulty[access.target]?{[access.target]:settings.studentDifficulty[access.target]}:{}};
 return reply({role:access.teacher?'teacher':'student',profile,settings:personal,studentId:access.target});
 }catch(error){return fail(error);}}
export async function POST(request:Request){try{
 if(request.headers.get('sec-fetch-site')==='cross-site'||!trainerOriginAllowed(request.headers.get('origin'),request.url,process.env.NEXT_PUBLIC_SITE_URL||'https://physics-tutor-6ytz.onrender.com'))throw new RoyaleError('Запрос отклонён.',403);
 const reader=request.body?.getReader();if(!reader)throw new RoyaleError('Нет данных.');const chunks:Uint8Array[]=[];let size=0;for(;;){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>100000){await reader.cancel();throw new RoyaleError('Слишком большая запись боя.',413);}chunks.push(r.value);}const input=JSON.parse(Buffer.concat(chunks).toString());if(!input||typeof input!=='object'||Array.isArray(input))throw new RoyaleError('Нужен объект.');
 if(input.action==='practice-answer'){const question=typeof input.questionId==='string'?publishedTrainerById.get(input.questionId):null;if(!question||!suitableTask(question)||typeof input.answer!=='string'||input.answer.length>128)throw new RoyaleError('Проверьте задание и ответ.');return reply({result:checkPublishedAnswer(question,normalizeUnitInput(question,input.answer))});}
 if(input.action==='abandon')return reply(await abandonMatch(request,input));if(input.action==='start')return reply(await startMatch(request,input));if(input.action==='question')return reply(await issueQuestion(request,input));if(input.action==='answer')return reply(await answerQuestion(request,input));if(input.action==='finish')return reply(await finishMatch(request,input));if(input.action==='deck'||input.action==='upgrade')return reply(await updateCollection(request,input));if(String(input.action).startsWith('teacher-'))return reply(await teacherSettings(request,input));throw new RoyaleError('Неизвестное действие.');
 }catch(error){return fail(error);}}
