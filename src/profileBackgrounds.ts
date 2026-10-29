export const PROFILE_BACKGROUND_NAMES: Record<string, string> = {
  background_concrete: 'Бетонный двор',
  background_brick: 'Кирпичный дом',
  background_panelka: 'Панелька',
};

export const getProfileBackground = (id?: string | null) => {
  switch (id) {
    case 'background_concrete':
      return {
        backgroundColor: '#484b49',
        backgroundImage: [
          'url("/concrete-noise.svg")',
          'radial-gradient(ellipse at 18% 16%, rgba(222,223,215,.12), transparent 36%)',
          'radial-gradient(ellipse at 82% 78%, rgba(12,15,14,.28), transparent 42%)',
          'linear-gradient(145deg, #555855, #3e4240 54%, #4b4e4b)',
        ].join(','),
        backgroundSize: '360px 360px, auto, auto, auto',
        backgroundBlendMode: 'soft-light,screen,multiply,normal',
      };
    case 'background_brick':
      return {
        backgroundColor: '#592f29',
        backgroundImage: 'url("/brick-graffiti.svg"),url("/brick-grain.svg"),repeating-linear-gradient(0deg, transparent 0 30px, rgba(194,164,145,.55) 30px 34px),linear-gradient(90deg, transparent 0 68px, rgba(194,164,145,.55) 68px 72px, transparent 72px 140px),linear-gradient(90deg, transparent 0 68px, rgba(194,164,145,.55) 68px 72px, transparent 72px 140px),linear-gradient(145deg, #8b4937, #542a27 55%, #703a30)',
        backgroundSize: '420px 360px,140px 68px,auto,140px 68px,140px 68px,auto',
        backgroundPosition: '0 0,0 0,0 0,0 0,70px 34px,0 0',
        backgroundBlendMode: 'normal,soft-light,normal,normal,normal,normal',
        backgroundRepeat: 'repeat',
      };
    case 'background_panelka':
      return {
        backgroundColor: '#aeb4aa',
        // A repeating facade: concrete panels, floor seams, windows and balcony rails.
        backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="190" viewBox="0 0 240 190"><rect width="240" height="190" fill="#aeb4aa"/><path d="M0 1H240M0 94H240M0 189H240M80 0V190M160 0V190" stroke="#d8d4c3" stroke-width="4"/><path d="M4 4H76V90H4ZM84 4H156V90H84ZM164 4H236V90H164ZM4 98H76V186H4ZM84 98H156V186H84ZM164 98H236V186H164Z" fill="#a5ada5" stroke="#89948e" stroke-width="1"/><g fill="#526b70" stroke="#dedac9" stroke-width="5"><rect x="20" y="20" width="38" height="43"/><rect x="101" y="20" width="38" height="43"/><rect x="182" y="20" width="38" height="43"/><rect x="20" y="114" width="38" height="42"/><rect x="101" y="114" width="38" height="42"/><rect x="182" y="114" width="38" height="42"/></g><g fill="none" stroke="#e4dfce" stroke-width="3"><path d="M17 66H61M17 70H61M98 66H142M98 70H142M179 66H223M179 70H223M17 159H61M17 163H61M98 159H142M98 163H142M179 159H223M179 163H223"/></g><g stroke="#c8c5b6" stroke-width="2"><path d="M39 20V63M120 20V63M201 20V63M39 114V156M120 114V156M201 114V156"/></g></svg>'
        )}")`,
        backgroundSize: '240px 190px',
        backgroundRepeat: 'repeat',
      };
    default:
      return {
        backgroundColor: '#efe3c8',
        backgroundImage: 'linear-gradient(145deg, #fbf4e4, #e7d9b8)',
      };
  }
};
