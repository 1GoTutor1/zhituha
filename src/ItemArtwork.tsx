const styles: Record<string, { base: string; accent: string }> = {
  stone: { base: '#8f969a', accent: '#d5dadd' }, coal: { base: '#31383d', accent: '#78838a' }, iron_ore: { base: '#8a6154', accent: '#d8aa83' }, emerald: { base: '#20a87a', accent: '#a8ffe0' },
  branch: { base: '#7b512c', accent: '#a2bc65' }, softwood: { base: '#c89155', accent: '#f1c184' }, hardwood: { base: '#754329', accent: '#ce9150' }, amber_wood: { base: '#b26b19', accent: '#ffe28a' },
  roach: { base: '#9ba5aa', accent: '#dce8eb' }, perch: { base: '#4ca16d', accent: '#f0c354' }, pike: { base: '#7c9891', accent: '#d6e2d5' }, sturgeon: { base: '#65717c', accent: '#c6a779' },
  potato: { base: '#b7874b', accent: '#f2d094' }, carrot: { base: '#ed8d32', accent: '#80b95c' }, corn: { base: '#f1c746', accent: '#8cb85b' }, strawberry: { base: '#e34e5a', accent: '#69ad58' }, watermelon: { base: '#4f9c60', accent: '#eb6b6e' },
};

export const ItemArtwork = ({ item, size = 96 }: { item: { item_id?: string; item_name?: string }; size?: number }) => {
  const id = item.item_id || 'stone';
  const { base, accent } = styles[id] || styles.stone;
  const shared = { fill: base, stroke: '#414942', strokeWidth: 2.4, strokeLinejoin: 'round' as const };
  const art = (() => {
    switch (id) {
      case 'stone': return <><path {...shared} d="M20 61 29 35 51 23 75 34 83 58 68 78 36 79Z"/><path d="m36 42 12-8m8 17-8 9m16-2 7 6" fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round"/></>;
      case 'coal': return <><path {...shared} d="m21 60 9-23 19-10 18 11 13 21-17 19-28-4Z"/><path d="m32 45 10-9m16 1 12 10m-7 20 9-8" fill="none" stroke={accent} strokeWidth="6" strokeLinecap="round"/></>;
      case 'iron_ore': return <><path {...shared} d="m19 61 15-32 24 3 23 22-12 25-33 1Z"/><path d="m34 52 15-12 8 10 13-3m-20 19 8-10" fill="none" stroke={accent} strokeWidth="6" strokeLinecap="round"/></>;
      case 'emerald': return <><path {...shared} d="m24 43 14-19h25l15 19-27 38Z"/><path d="m38 24 13 57 12-57M24 43h54" fill="none" stroke={accent} strokeWidth="4" opacity=".9"/></>;
      case 'branch': return <><path d="M22 73 72 25" fill="none" stroke={base} strokeWidth="13" strokeLinecap="round"/><path d="m42 55-9-21m18 9 20-8m-30 30-19 4" fill="none" stroke={accent} strokeWidth="8" strokeLinecap="round"/></>;
      case 'softwood': return <><rect x="20" y="34" width="60" height="45" rx="8" {...shared}/><ellipse cx="21" cy="56" rx="10" ry="22" fill={accent} stroke="#342d27" strokeWidth="3"/><path d="M21 42v28m10-25 38 26" stroke="#8e5e35" strokeWidth="4"/></>;
      case 'hardwood': return <><path {...shared} d="M19 35h59v15H19zm6 19h59v15H25zm-5 19h54v10H20z"/><path d="M28 42h38m-30 20h37m-28 16h25" stroke={accent} strokeWidth="4" strokeLinecap="round"/></>;
      case 'amber_wood': return <><path {...shared} d="m25 75 10-51h30l11 51Z"/><path d="M37 33h25M34 47h34M31 62h40" stroke={accent} strokeWidth="5" strokeLinecap="round"/><circle cx="50" cy="54" r="6" fill="#fff0b0"/></>;
      case 'roach': return <><path {...shared} d="M17 51q19-25 47-8l18 8-18 9q-28 16-47-9Z"/><path d="m20 51-12-12v24Z" fill={accent} stroke="#342d27" strokeWidth="3"/><circle cx="65" cy="48" r="3" fill="#26231f"/><path d="M40 42q9 9 0 18" fill="none" stroke={accent} strokeWidth="3"/></>;
      case 'perch': return <><path {...shared} d="M16 52q22-26 54-10l16 10-16 10q-32 16-54-10Z"/><path d="m20 52-13-13v26Z" fill={accent} stroke="#342d27" strokeWidth="3"/><path d="m43 40 10-12 12 15m-22 18 11 12 12-17" fill={base} stroke="#342d27" strokeWidth="3"/><path d="M40 42v20m11-22v24" stroke={accent} strokeWidth="3"/><circle cx="67" cy="48" r="3" fill="#24211e"/></>;
      case 'pike': return <><path {...shared} d="M10 51q29-23 69-4l14 4-14 4q-40 19-69-4Z"/><path d="m18 51-12-11v22Z" fill={accent} stroke="#342d27" strokeWidth="3"/><path d="m44 42 12-9 8 15m-20 11 12 10 9-16" fill={base} stroke="#342d27" strokeWidth="3"/><circle cx="71" cy="48" r="3" fill="#24211e"/></>;
      case 'sturgeon': return <><path {...shared} d="M10 52q30-20 72-8l14 8-14 8q-42 12-72-8Z"/><path d="m18 51-14-12v26Z" fill={accent} stroke="#342d27" strokeWidth="3"/><path d="M38 42v20m12-22v24m12-22v20M79 50l12-4m-12 10 12 5" fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round"/><circle cx="73" cy="49" r="3" fill="#24211e"/></>;
      case 'potato': return <><path {...shared} d="M18 54q2-23 26-27 14-13 30 2 20 13 7 35-7 23-31 15-26 8-32-25Z"/><circle cx="39" cy="46" r="3" fill={accent}/><circle cx="63" cy="60" r="3" fill={accent}/><circle cx="43" cy="67" r="2.5" fill={accent}/></>;
      case 'carrot': return <><path {...shared} d="m24 34 52 9-32 42Z"/><path d="M49 34q-7-15-19-12m23 11q3-17 18-19m-12 22q15-10 23-2" fill="none" stroke={accent} strokeWidth="7" strokeLinecap="round"/><path d="m39 48 16 3m-22 9 12 3" stroke="#c46d24" strokeWidth="3"/></>;
      case 'corn': return <><ellipse cx="50" cy="53" rx="22" ry="34" fill={base} stroke="#342d27" strokeWidth="3"/><path d="M32 31q-19 21-9 49l25-9m20-40q18 24 10 47L52 67" fill={accent} stroke="#342d27" strokeWidth="3"/><path d="M41 34v38m10-41v43m10-38v31" stroke="#d49b2a" strokeWidth="3" strokeDasharray="2 6"/></>;
      case 'strawberry': return <><path {...shared} d="M24 42q26-17 52 0l-3 17-23 25-23-25Z"/><path d="M50 40q-1-17-14-18m15 18q9-18 22-16m-22 17q-2-15 3-22" fill="none" stroke={accent} strokeWidth="7" strokeLinecap="round"/><g fill="#ffe59b"><circle cx="39" cy="51" r="2"/><circle cx="61" cy="51" r="2"/><circle cx="49" cy="63" r="2"/><circle cx="39" cy="66" r="2"/></g></>;
      case 'watermelon': return <><path {...shared} d="M18 66q31-57 64-1-32 30-64 1Z"/><path d="M27 65q21-38 46 0M37 70l5-7m18 7-5-7" fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round"/><g fill="#35291f"><ellipse cx="43" cy="57" rx="2" ry="4"/><ellipse cx="58" cy="59" rx="2" ry="4"/></g></>;
      default: return <><path {...shared} d="M20 61 29 35 51 23 75 34 83 58 68 78 36 79Z"/></>;
    }
  })();
  return <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={item.item_name || id}>
    <ellipse cx="50" cy="87" rx="31" ry="6" fill="rgba(34,41,36,.08)" />{art}
  </svg>;
};
