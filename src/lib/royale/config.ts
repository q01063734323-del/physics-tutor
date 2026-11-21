export type CardId='knight'|'archers'|'giant'|'skeletons'|'dragon'|'mage'|'fireball'|'guardians';
export type Difficulty='novice'|'physicist'|'professor';
export type Side='player'|'bot';
export type Tier='easy'|'medium'|'hard';
export type CardDefinition={id:CardId;name:string;cost:number;hp:number;damage:number;speed:number;cooldown:number;range:number;radius:number;count:number;targets:'all'|'ground'|'buildings';flying?:boolean;splash?:number;armor?:number;rarity:string;description:string};
export const cards:Record<CardId,CardDefinition>={
 knight:{id:'knight',name:'Рыцарь рассвета',cost:3,hp:480,damage:58,speed:40,cooldown:.9,range:22,radius:13,count:1,targets:'ground',rarity:'Обычная',description:'Надёжный боец ближнего боя. Прикрывает стрелков.'},
 archers:{id:'archers',name:'Лесные лучницы',cost:3,hp:145,damage:29,speed:43,cooldown:1,range:145,radius:10,count:2,targets:'all',rarity:'Обычная',description:'Две дальние атаки. Сбивают воздушные цели.'},
 giant:{id:'giant',name:'Каменный великан',cost:5,hp:1250,damage:102,speed:27,cooldown:1.5,range:26,radius:20,count:1,targets:'buildings',rarity:'Редкая',description:'Идёт к башням, игнорируя войска. Нуждается в сопровождении.'},
 skeletons:{id:'skeletons',name:'Костяной дозор',cost:2,hp:65,damage:26,speed:61,cooldown:.7,range:18,radius:8,count:4,targets:'ground',rarity:'Обычная',description:'Быстрая группа окружает одиночных бойцов. Уязвима к области.'},
 dragon:{id:'dragon',name:'Лазурный дракон',cost:4,hp:480,damage:51,speed:37,cooldown:1.3,range:100,radius:15,count:1,targets:'all',flying:true,splash:47,rarity:'Эпическая',description:'Летает над рекой. Дыхание задевает группу противников.'},
 mage:{id:'mage',name:'Хранитель искры',cost:4,hp:300,damage:73,speed:33,cooldown:1.4,range:135,radius:12,count:1,targets:'all',splash:50,rarity:'Редкая',description:'Дальние огненные снаряды против плотных отрядов.'},
 fireball:{id:'fireball',name:'Пламя кометы',cost:4,hp:0,damage:300,speed:0,cooldown:0,range:0,radius:74,count:0,targets:'all',splash:74,rarity:'Редкая',description:'Удар по выбранной области. Башни получают 35% урона.'},
 guardians:{id:'guardians',name:'Стражи янтаря',cost:3,hp:220,damage:37,speed:35,cooldown:1,range:22,radius:11,count:3,targets:'ground',armor:.22,rarity:'Эпическая',description:'Три защитника с бронёй. Останавливают наземное наступление.'},
};
export const cardIds=Object.keys(cards) as CardId[];
export const balance={version:1,tickMs:50,width:420,height:720,riverTop:344,riverBottom:376,bridges:[110,310],bridgeHalf:23,startEnergy:4,maxEnergy:10,rewards:{easy:2,medium:4,hard:6} as Record<Tier,number>,matchSeconds:180,botEnergyPerSecond:.16,tower:{guardHp:1650,kingHp:2400,range:170,damage:47,cooldownSeconds:1},focusScale:.2,focusBudgetSeconds:120,focusPerQuestionSeconds:35,maxUnits:100,maxCommands:400};
export type RoyaleSettings={rewards:Record<Tier,number>;disabled:string[];taskTiers:Record<string,Tier>;arenaTopics:Record<string,string[]>;studentTopics:Record<string,string[]>;studentDifficulty:Record<string,Difficulty>;focusScale:number};
export const defaultSettings:RoyaleSettings={rewards:{...balance.rewards},disabled:[],taskTiers:{},arenaTopics:{},studentTopics:{},studentDifficulty:{},focusScale:balance.focusScale};
export const arenas=[
 {id:'academy',name:'Академия формул',trophies:0,topic:'all',description:'Первые знания, первые победы.',grass:'#367660',water:'#348db2',accent:'#f1c56e'},
 {id:'mechanics',name:'Королевство механики',trophies:60,topic:'Механика',description:'Сила, движение и точность решения.',grass:'#4d7b48',water:'#3d8dbe',accent:'#d4df88'},
 {id:'heat',name:'Огненная крепость',trophies:150,topic:'Молекулярная физика и термодинамика',description:'Теплота, работа и энергия.',grass:'#79523f',water:'#cf6f39',accent:'#ffcb8d'},
 {id:'electricity',name:'Электрическая цитадель',trophies:280,topic:'Электродинамика',description:'Токи, поля и сильные комбинации.',grass:'#3c587b',water:'#7274d5',accent:'#b6a6ff'},
 {id:'masters',name:'Арена мастеров ЕГЭ',trophies:450,topic:'all',description:'Смешанные задания из всего банка.',grass:'#52517a',water:'#419da1',accent:'#f4d7a0'},
];
export function isCardId(id:unknown):id is CardId{return typeof id==='string' && cardIds.includes(id as CardId);}
export function validDeck(value:unknown):value is CardId[]{return Array.isArray(value)&&value.length===8&&new Set(value).size===8&&value.every(isCardId);}
export function cardLevel(value:unknown){return typeof value==='number'&&Number.isInteger(value)?Math.max(1,Math.min(5,value)):1;}
export function levelScale(level:number){return 1+.04*(cardLevel(level)-1);}
export const difficultyLabels:Record<Difficulty,string>={novice:'Новичок',physicist:'Физик',professor:'Профессор'};
