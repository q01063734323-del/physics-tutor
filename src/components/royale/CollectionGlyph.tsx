const shapes={
 atom:<><ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-60 12 12)"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/></>,
 heart:<path d="M12 21 3.6 12.7C-.4 8.2 3.9 2.2 8.2 4.4L12 7l3.8-2.6c4.3-2.2 8.6 3.8 4.6 8.3Z"/>,
 swords:<><path d="m3 3 5 1 12 13-3 3L4 8Z"/><path d="M21 3 16 4l-4 5m-3 3-6 6 3 3 6-6M15 18l5 5M4 15l5 5"/></>,
 target:<><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v5m0 12v5M1 12h5m12 0h5"/></>,
 energy:<path d="m14 2-9 12h6l-1 8 9-12h-6Z"/>,
 clock:<><circle cx="12" cy="13" r="8"/><path d="M10 1h4m-2 4V1m6 6 2-2m-8 4v5l4 2"/></>,
 speed:<><path d="M2 13h10m-6 4h7m-3 4h6M16 3 6 11h8l-2 7 9-10h-6Z"/></>,
 deck:<><path d="M7 3h13v18H7zM2 7l1.5 13 2 .7m5.5-13 3-3 3 3-3 4Z"/></>,
 search:<><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></>,
 filter:<path d="M3 4h18l-7 8v7l-4 2v-9Z"/>,
 play:<path d="m7 3 15 9-15 9Z"/>,
 shield:<path d="M12 2 21 6v6c0 4-3 7-9 10-6-3-9-6-9-10V6Z"/>,
};
export type CollectionIcon=keyof typeof shapes;
export function CollectionGlyph({name}:{name:CollectionIcon}){
 return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">{shapes[name]}</svg>;
}
