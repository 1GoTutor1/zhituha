export const PROFILE_BACKGROUND_NAMES: Record<string, string> = {
  background_concrete: 'Бетонный двор',
  background_brick: 'Кирпичный дом',
  background_panelka: 'Панелька',
};

export const getProfileBackground = (id?: string | null) => {
  switch (id) {
    case 'background_concrete':
      return {
        backgroundColor: '#858b83',
        backgroundImage: [
          'radial-gradient(circle, rgba(39,46,41,.13) 0 1px, transparent 1.4px)',
          'radial-gradient(circle, rgba(255,255,255,.17) 0 1px, transparent 1.5px)',
          'radial-gradient(ellipse at 17% 19%, rgba(255,255,255,.22), transparent 29%)',
          'radial-gradient(ellipse at 84% 76%, rgba(30,36,32,.2), transparent 34%)',
          'linear-gradient(164deg, transparent 0 39%, rgba(48,55,50,.12) 39.1% 39.35%, transparent 39.5% 100%)',
          'repeating-linear-gradient(0deg, transparent 0 70px, rgba(35,42,38,.14) 70px 72px)',
          'repeating-linear-gradient(90deg, transparent 0 118px, rgba(35,42,38,.13) 118px 120px)',
          'linear-gradient(145deg, #b7bbb3, #7a827a 52%, #a0a59c)',
        ].join(','),
        backgroundSize: '17px 19px, 23px 29px, auto, auto, auto, auto, auto, auto',
      };
    case 'background_brick':
      return {
        backgroundColor: '#954b37',
        backgroundImage: 'repeating-linear-gradient(0deg, transparent 0 30px, rgba(231,194,155,.72) 30px 34px),linear-gradient(90deg, transparent 0 68px, rgba(231,194,155,.72) 68px 72px, transparent 72px 140px),linear-gradient(90deg, transparent 0 68px, rgba(231,194,155,.72) 68px 72px, transparent 72px 140px),linear-gradient(145deg, #bd7455, #874434 55%, #a65f47)',
        backgroundSize: 'auto,140px 68px,140px 68px,auto',
        backgroundPosition: '0 0,0 0,70px 34px,0 0',
        backgroundRepeat: 'repeat',
      };
    case 'background_panelka':
      return {
        backgroundColor: '#8c9995',
        backgroundImage: [
          'radial-gradient(ellipse at 18% 14%, rgba(255,255,255,.18), transparent 28%)',
          'linear-gradient(90deg, transparent 0 18px, rgba(238,226,196,.72) 18px 21px, #536c70 21px 49px, rgba(41,57,60,.72) 49px 52px, transparent 52px 68px, rgba(238,226,196,.7) 68px 71px, #61777a 71px 99px, rgba(41,57,60,.7) 99px 102px, transparent 102px 120px)',
          'repeating-linear-gradient(0deg, transparent 0 57px, rgba(235,222,191,.8) 57px 62px, transparent 62px 120px)',
          'repeating-linear-gradient(90deg, transparent 0 118px, rgba(69,85,83,.36) 118px 122px)',
          'linear-gradient(145deg, #c1c0ad, #82918c 55%, #a6aaa0)',
        ].join(','),
        backgroundSize: 'auto, 120px 120px, auto, auto, auto',
        backgroundPosition: '0 0, 0 0, 0 0, 0 0, 0 0',
        backgroundRepeat: 'repeat',
      };
    default:
      return {
        backgroundColor: '#efe3c8',
        backgroundImage: 'linear-gradient(145deg, #fbf4e4, #e7d9b8)',
      };
  }
};
