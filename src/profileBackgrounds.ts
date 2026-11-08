export const PROFILE_BACKGROUND_NAMES: Record<string, string> = {
  background_concrete: 'Бетонный двор',
  background_brick: 'Кирпичный дом',
  background_panelka: 'Панелька',
  background_night_route: 'Ночной маршрут',
  background_family_timenewromans: 'Победители семейного сезона',
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
        backgroundColor: '#101522',
        backgroundImage: 'linear-gradient(rgba(13,17,27,.3),rgba(13,17,27,.3)),url("/images/background-night-route.webp")',
        backgroundSize: 'cover,cover',
        backgroundPosition: 'center,center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
      };
    case 'background_family_timenewromans':
      return {
        backgroundColor: '#1b101d',
        backgroundImage: 'linear-gradient(rgba(20,12,22,.22),rgba(20,12,22,.22)),url("/images/family-timenewromans-season-winner.webp")',
        backgroundSize: 'cover,cover',
        backgroundPosition: 'center,center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
      };
    default:
      return {
        backgroundColor: '#efe3c8',
        backgroundImage: 'linear-gradient(145deg, #fbf4e4, #e7d9b8)',
      };
  }
};
