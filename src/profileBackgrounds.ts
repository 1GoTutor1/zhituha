export const PROFILE_BACKGROUND_NAMES: Record<string, string> = {
  background_concrete: 'Бетонный двор',
  background_brick: 'Кирпичный дом',
  background_panelka: 'Панелька',
  background_night_route: 'Ночной маршрут',
};

export const getProfileBackground = (id?: string | null) => {
  switch (id) {
    case 'background_concrete':
      return {
        backgroundColor: '#484b49',
        backgroundImage: [
          'url("/concrete-cracks.svg")',
          'url("/concrete-noise.svg")',
          'radial-gradient(ellipse at 18% 16%, rgba(222,223,215,.12), transparent 36%)',
          'radial-gradient(ellipse at 82% 78%, rgba(12,15,14,.28), transparent 42%)',
          'linear-gradient(145deg, #555855, #3e4240 54%, #4b4e4b)',
        ].join(','),
        backgroundSize: '360px 360px, 360px 360px, auto, auto, auto',
        backgroundBlendMode: 'multiply,soft-light,screen,multiply,normal',
      };
    case 'background_brick':
      return {
        backgroundColor: '#592f29',
        backgroundImage: 'repeating-linear-gradient(0deg, transparent 0 30px, rgba(194,164,145,.55) 30px 34px),linear-gradient(90deg, transparent 0 68px, rgba(194,164,145,.55) 68px 72px, transparent 72px 140px),linear-gradient(90deg, transparent 0 68px, rgba(194,164,145,.55) 68px 72px, transparent 72px 140px),url("/brick-wear.svg"),url("/brick-grain.svg"),linear-gradient(145deg, #8b4937, #542a27 55%, #703a30)',
        backgroundSize: 'auto,140px 68px,140px 68px,840px 816px,140px 68px,auto',
        backgroundPosition: '0 0,0 0,70px 34px,0 0,0 0,0 0',
        backgroundBlendMode: 'normal,normal,normal,soft-light,soft-light,normal',
        backgroundRepeat: 'repeat',
      };
    case 'background_panelka':
      return {
        backgroundColor: '#777d76',
        backgroundImage: 'url("/panelka-evening.svg")',
        backgroundSize: '240px 190px',
        backgroundRepeat: 'repeat',
      };
    case 'background_night_route':
      return {
        backgroundColor: '#171922',
        backgroundImage: 'radial-gradient(ellipse at 18% 14%, rgba(235,167,66,.18), transparent 25%),linear-gradient(28deg, transparent 0 47%, rgba(230,169,75,.22) 47.4% 48.1%, transparent 48.5%),linear-gradient(150deg, transparent 0 56%, rgba(72,173,177,.18) 56.4% 57.1%, transparent 57.5%),linear-gradient(145deg,#191b25,#242330 55%,#171922)',
        backgroundSize: 'auto,100% 100%,100% 100%,auto',
        backgroundRepeat: 'no-repeat',
      };
    default:
      return {
        backgroundColor: '#efe3c8',
        backgroundImage: 'linear-gradient(145deg, #fbf4e4, #e7d9b8)',
      };
  }
};
