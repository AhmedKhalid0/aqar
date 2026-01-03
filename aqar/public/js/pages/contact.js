/**
 * Contact Page Module
 */

Site.pages.contact = async function () {
    const lang = getCurrentLang();

    // Generate CAPTCHA
    let captchaAnswer = null;
    const generateCaptcha = () => {
        const num1 = Math.floor(Math.random() * 10) + 1;
        const num2 = Math.floor(Math.random() * 10) + 1;
        const operators = ['+', '-', '×'];
        const op = operators[Math.floor(Math.random() * operators.length)];
        let answer;
        let question;

        switch (op) {
            case '+': answer = num1 + num2; question = `${num1} + ${num2} = ?`; break;
            case '-': answer = num1 - num2; question = `${num1} - ${num2} = ?`; break;
            case '×': answer = num1 * num2; question = `${num1} × ${num2} = ?`; break;
        }

        captchaAnswer = answer;
        const captchaEl = document.getElementById('captchaQuestion');
        if (captchaEl) captchaEl.textContent = question;
    };

    // Initialize CAPTCHA
    generateCaptcha();

    // Load contact info from settings
    try {
        const settings = await Site.fetchAPI('/api/settings');
        if (settings.contact) {
            const phoneEl = document.getElementById('contactPhoneLink');
            const emailEl = document.getElementById('contactEmailLink');
            const addressEl = document.getElementById('contactAddress');
            const hoursEl = document.getElementById('contactHours');

            if (phoneEl && settings.contact.phone) {
                phoneEl.textContent = settings.contact.phone;
                phoneEl.href = `tel:${settings.contact.phone.replace(/\s/g, '')}`;
            }
            if (emailEl && settings.contact.email) {
                emailEl.textContent = settings.contact.email;
                emailEl.href = `mailto:${settings.contact.email}`;
            }
            if (addressEl && settings.contact.address?.[lang]) {
                addressEl.textContent = settings.contact.address[lang];
            }
            if (hoursEl && settings.contact.workingHours?.[lang]) {
                hoursEl.textContent = settings.contact.workingHours[lang];
            }
        }
    } catch (error) {
        console.error('Error loading contact info:', error);
    }

    // Handle contact form
    const form = document.getElementById('contactForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Validate CAPTCHA
            const captchaInput = document.getElementById('captchaAnswer');
            if (captchaInput && parseInt(captchaInput.value) !== captchaAnswer) {
                alert(lang === 'ar' ? 'إجابة السؤال غير صحيحة!' : 'Wrong CAPTCHA answer!');
                generateCaptcha();
                captchaInput.value = '';
                return;
            }

            const btn = form.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

            try {
                const data = {
                    name: document.getElementById('contactName').value,
                    email: document.getElementById('contactEmail').value,
                    phone: document.getElementById('contactPhone').value,
                    subject: document.getElementById('contactSubject').value,
                    message: document.getElementById('contactMessage').value
                };

                await Site.fetchAPI('/api/contact', {
                    method: 'POST',
                    body: JSON.stringify(data)
                });

                // Show success
                document.getElementById('successAlert').style.display = 'block';
                document.getElementById('errorAlert').style.display = 'none';
                form.reset();
                generateCaptcha();

                // Hide success after 5 seconds
                setTimeout(() => {
                    document.getElementById('successAlert').style.display = 'none';
                }, 5000);

            } catch (error) {
                document.getElementById('errorAlert').style.display = 'block';
                document.getElementById('successAlert').style.display = 'none';
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        });
    }
};
