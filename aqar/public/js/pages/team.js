/**
 * Team Page Module
 */

Site.pages.team = async function () {
    const lang = getCurrentLang();

    try {
        const team = await Site.fetchAPI('/api/team');
        const container = document.getElementById('teamGrid');
        if (!container) return;

        if (!team || team.length === 0) {
            Site.showEmpty(container, lang === 'ar' ? 'لا يوجد أعضاء فريق' : 'No team members', 'bi-people');
            return;
        }

        container.innerHTML = '';
        team.forEach(member => {
            const col = document.createElement('div');
            col.className = 'col-lg-3 col-md-4 col-6 mb-4';
            col.innerHTML = `
                <div class="team-card text-center">
                    <img src="${member.image || '/images/placeholder.jpg'}" alt="${member.name?.[lang] || ''}" class="team-img mb-3">
                    <h5>${member.name?.[lang] || member.name?.ar || ''}</h5>
                    <p class="text-muted">${member.position?.[lang] || member.position?.ar || ''}</p>
                </div>
            `;
            container.appendChild(col);
        });
    } catch (error) {
        console.error('Error loading team:', error);
    }
};
