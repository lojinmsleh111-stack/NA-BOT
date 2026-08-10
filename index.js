const { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ChannelType, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require('discord.js');
const { Groq } = require('groq-sdk');

// ==============================
//           الإعدادات
// ==============================
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// رومات اللوج الجديدة
const ACCEPT_LOG_CHANNEL_ID = '1521844992811728906'; // روم لوق المقبولين
const REJECT_LOG_CHANNEL_ID = '1521845037535854642'; // روم لوق المرفوضين

// رتبة التصريح (اضف ايدي الرتبة في متغيرات البيئة Render أو استبدله هنا)
const ROLE_ID = process.env.ROLE_ID || 'YOUR_ROLE_ID_HERE';

const TARGET_CHANNEL_ID = '1510857986778726641';

// ==============================
//        بدء تشغيل الخدمات
// ==============================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],
    partials: ['CHANNEL']
});

const groq = new Groq({ apiKey: GROQ_API_KEY });
const applySessions = new Map();

// ==============================
//        الأسئلة (بالترتيب)
// ==============================
const applyQuestions = [
    { id: 'q1', text: '1/5. الاسم الكريم' },
    { id: 'q2', text: '2/5. عمرك' },
    { id: 'q3', text: '3/5. اسم حسابك روب الأساسي' },
    { id: 'q4', text: '4/5. اختصار حسابك' },
    { id: 'q5', text: '5/5. اقسم بالله العظيم أنا (فلان) لن اخرب رولات مجتمع النظيم وان احترم الجميع وان احترم الاداره ولا اطول لساني عليهم و احترم جميع أعضاء السيرفر والله على ما اقوله شهيد.\n\n(اكتب القسم كاملاً كما هو)' }
];

// ==============================
//     تسجيل الأوامر (Slash Commands)
// ==============================
const commands = [
    new SlashCommandBuilder()
        .setName('roleplay')
        .setDescription('إرسال إعلان الرول بلاي')
        .addStringOption(option =>
            option.setName('حسابك_روبلوكس')
                .setDescription('ادخل اسم حساب الهوست في روبلوكس')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('وقت_بداية_الرول')
                .setDescription('ادخل وقت بداية الرول')
                .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('rate')
        .setDescription('إرسال رسالة تقييم الرول'),
    new SlashCommandBuilder()
        .setName('vote')
        .setDescription('إرسال رسالة تصويت لفتح الرول بلاي'),
    new SlashCommandBuilder()
        .setName('schedule')
        .setDescription('إرسال أوقات الرول بلاي عند عدم وجود منظم'),
    new SlashCommandBuilder()
        .setName('apply')
        .setDescription('بدء تقديم تصريح جديد عبر الذكاء الاصطناعي'),
    new SlashCommandBuilder()
        .setName('setup-apply')
        .setDescription('إنشاء بانل التقديم (للإدارة)')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

(async () => {
    try {
        console.log('جاري تسجيل الأوامر...');
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );
        console.log('تم تسجيل جميع الأوامر بنجاح!');
    } catch (error) {
        console.error('حدث خطأ أثناء تسجيل الأوامر:', error);
    }
})();

// ==============================
//        الوظائف المساعدة
// ==============================
async function generateUniqueId(guild) {
    await guild.members.fetch(); 
    let isUnique = false;
    let randomId = '';

    while (!isUnique) {
        randomId = Math.floor(100000 + Math.random() * 900000).toString();
        const exists = guild.members.cache.some(member => member.nickname && member.nickname.includes(randomId));
        if (!exists) {
            isUnique = true;
        }
    }
    return randomId;
}

async function startApplicationProcess(user, interaction = null) {
    const userId = user.id;
    if (applySessions.has(userId)) {
        const msg = 'لديك جلسة تقديم جارية بالفعل في الخاص.';
        return interaction ? interaction.reply({ content: msg, ephemeral: true }) : null;
    }

    try {
        const dmChannel = await user.createDM();
        const startEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('Application Started')
            .setDescription('نحن سعداء بتقدملك لمجتمع النظيم.\nيرجى الإجابة على الأسئلة التالية بعناية، سيتم مراجعة إجاباتك بواسطة الذكاء الاصطناعي.\n\nبدءاً من الآن، أرسل إجاباتك كرسايل عادية في هذه المحادثة.');

        await dmChannel.send({ embeds: [startEmbed] });
        await dmChannel.send(`**${applyQuestions[0].text}**`);

        applySessions.set(userId, {
            currentQuestionIndex: 0,
            answers: [],
            dmChannelId: dmChannel.id
        });

        if (interaction) {
            await interaction.reply({ content: 'تم بدء التقديم! يرجى التحقق من الرسائل الخاصة بك (DM).', ephemeral: true });
        }
    } catch (error) {
        if (interaction) {
            await interaction.reply({ content: 'لا يمكنني بدء التقديم. يرجى التأكد من تفعيل الرسائل الخاصة.', ephemeral: true });
        }
    }
}

// ==============================
//      منطق معالجة الأوامر والأزرار
// ==============================
client.once('ready', () => {
    console.log(`تم تشغيل البوت بنجاح باسم: ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
    // 1. التعامل مع نقرات الأزرار (Button Interaction)
    if (interaction.isButton()) {
        const customId = interaction.customId;

        // بدء التقديم
        if (customId === 'start_apply_button') {
            return await startApplicationProcess(interaction.user, interaction);
        }

        // الأزرار الإدارية (قبول يدوي / رفض يدوي)
        if (customId.startsWith('manual_accept_') || customId.startsWith('manual_reject_')) {
            const parts = customId.split('_');
            const action = parts[1]; // accept or reject
            const targetUserId = parts[2];
            const robloxName = parts.slice(3).join('_') || 'User';

            const guild = await client.guilds.fetch(GUILD_ID);
            let member;
            try {
                member = await guild.members.fetch(targetUserId);
            } catch (err) {
                return interaction.reply({ content: 'تعذر العثور على العضو في السيرفر.', ephemeral: true });
            }

            if (action === 'accept') {
                // تغيير الاسم وإضافة الرتبة
                try {
                    const uniqueId = await generateUniqueId(guild);
                    const newNickname = `NA | ${robloxName} | ${uniqueId}`;
                    await member.setNickname(newNickname);
                    if (ROLE_ID) await member.roles.add(ROLE_ID);

                    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                        .setColor(0x00FF00)
                        .setTitle(`تم القبول يدوياً بواسطة: ${interaction.user.tag}`)
                        .addFields({ name: 'الاسم الجديد', value: `\`${newNickname}\`` });

                    await interaction.update({ embeds: [updatedEmbed], components: [] });
                } catch (err) {
                    console.error(err);
                    return interaction.reply({ content: 'حدث خطأ أثناء تعديل رتبة أو اسم العضو (تأكد من الصلاحيات).', ephemeral: true });
                }
            } else if (action === 'reject') {
                // إعادة الاسم وإزالة الرتبة
                try {
                    await member.setNickname(null); // إلغاء اللقب
                    if (ROLE_ID) await member.roles.remove(ROLE_ID);

                    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                        .setColor(0xFF0000)
                        .setTitle(`تم الرفض يدوياً بواسطة: ${interaction.user.tag}`);

                    await interaction.update({ embeds: [updatedEmbed], components: [] });
                } catch (err) {
                    console.error(err);
                    return interaction.reply({ content: 'حدث خطأ أثناء سحب الرتبة أو تعديل اسم العضو.', ephemeral: true });
                }
            }
            return;
        }
    }

    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'setup-apply') {
        const panelEmbed = new EmbedBuilder()
            .setColor(0x2F3136)
            .setTitle('📝 تقديم تصريح مجتمع النظيم')
            .setDescription('مرحباً بك! لتقديم طلب الحصول على تصريح داخل السيرفر، اضغط على الزر أدناه للبدء.\n\n⚠️ **ملاحظة:** سيقوم البوت بالتواصل معك في الرسائل الخاصة (DM) لطرح الأسئلة ومراجعتها بواسطة الذكاء الاصطناعي.')
            .setFooter({ text: 'مجتمع النظيم للعب الواقعي' });

        const applyButton = new ButtonBuilder()
            .setCustomId('start_apply_button')
            .setLabel('بدء التقديم 📝')
            .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder().addComponents(applyButton);

        await interaction.channel.send({ embeds: [panelEmbed], components: [row] });
        return interaction.reply({ content: 'تم إنشاء بانل التقديم بنجاح!', ephemeral: true });
    }

    if (interaction.commandName === 'apply') {
        return await startApplicationProcess(interaction.user, interaction);
    }

    if (interaction.channelId !== TARGET_CHANNEL_ID) {
        return interaction.reply({ content: 'لا يمكنك استخدام هذا الأمر إلا في الروم المخصص له!', ephemeral: true });
    }

    if (interaction.commandName === 'roleplay') {
        const hostAccount = interaction.options.getString('حسابك_روبلوكس');
        const startTime = interaction.options.getString('وقت_بداية_الرول');

        const responseText = 
`__**رول بلاي مجتمع النظيم**__

__**تم اعلان رول بلاي Greenville جميع الي يدخلون رول صفو بالمعرض **__

__**اسم حساب الهوست :**__ ${hostAccount}

__**ابتدا رول متى :**__ ${startTime}

__**القوانين**__ <#1508628309636944013>

__**ممنوع التخريب منعاً باتا**__

__**يجب احترام الجميع**__

__**لا يجب الافساد برول**__

__**اتمنى لكم رول ممتع🤍**__

<@&1508335599289897101> 


<@&1508327075151613972> 


<@&1508327730075140186>

@everyone`;

        await interaction.reply({ content: responseText });
    }

    if (interaction.commandName === 'rate') {
        const rateText = 
`__**تقييم رولي**__

__**اذا عجبك رول صوت ✓**__

__**شكراً لتصويتك هذا يساعدنا نفتح الرول بلاي ماقصرتو**__

__**اذا ماعجبك رول حط ❌**__

**__ لو تحط صح وانت مبلك تايم 1h__**

@everyone`;

        const replyMessage = await interaction.reply({ content: rateText, fetchReply: true });
        try {
            await replyMessage.react('✓');
            await replyMessage.react('❌');
        } catch (error) { console.error(error); }
    }

    if (interaction.commandName === 'vote') {
        const voteText = 
`__**تصويت رول بلاي**__

__**في حال تبي رول بلاي صوت ب ✓**__

__**شكراً لتصويتك هذا يساعدنا نفتح الرول بلاي ماقصرتو**__

@everyone`;

        const replyMessage = await interaction.reply({ content: voteText, fetchReply: true });
        try { await replyMessage.react('✓'); } catch (error) { console.error(error); }
    }

    if (interaction.commandName === 'schedule') {
        const scheduleText = 
`__**اوقات رول بلاي**__

__**من الساعه 12الظهر الى 2**__

__**من الساعه 4 العصر الى 6**__

__**من الساعه 8 العشاء الى 10**__

__**من الساعه 1 اليل الى 3**__

@everyone`;

        await interaction.reply({ content: scheduleText });
    }
});

// ==============================
//      استقبال الإجابات في الخاص
// ==============================
client.on('messageCreate', async (message) => {
    if (message.author.bot || message.channel.type !== ChannelType.DM) return;

    const userId = message.author.id;
    const session = applySessions.get(userId);
    if (!session) return;

    const currentQuestion = applyQuestions[session.currentQuestionIndex];
    session.answers.push({ question: currentQuestion.text, answer: message.content });
    session.currentQuestionIndex++;

    if (session.currentQuestionIndex < applyQuestions.length) {
        await message.channel.send(`**${applyQuestions[session.currentQuestionIndex].text}**`);
    } else {
        const finishingEmbed = new EmbedBuilder()
            .setColor(0xFF9900)
            .setTitle('Application Submitted')
            .setDescription('تم استلام جميع إجاباتك. جاري مراجعتها الآن بواسطة الذكاء الاصطناعي وإرسال التقرير للإدارة.\nشكراً لصبرك.');

        await message.channel.send({ embeds: [finishingEmbed] });
        await reviewApplicationWithAI(message.author, session.answers);
        applySessions.delete(userId);
    }
});

// ==============================
//    وظيفة الذكاء الاصطناعي
// ==============================
async function reviewApplicationWithAI(user, answers) {
    let formattedAnswers = answers.map((a, i) => `س${i+1}: ${a.question}\nج${i+1}: ${a.answer}`).join('\n\n');

    const prompt = `
    أنت مساعد إداري ذكي في سيرفر ديسكورد للعب الواقعي (Roleplay) في مجتمع "النظيم". مهمتك هي مراجعة تقديم تصريح لمستخدم جديد.

    المستخدم: ${user.tag} (الايدي: ${user.id})

    الإجابات المقدمة:
    ${formattedAnswers}

    قم بتحليل التقديم بعناية وفق الشروط:
    1. الاسم جاد وحقيقي.
    2. اسم حساب روبلوكس مدخل بوضوح.
    3. كتب القسم كاملاً وبدقة في السؤال 5 بدون تحريف.

    صيغة الرد المطلوبة:
    ابدأ السطر الأول بكلمة [مقبول] أو [مرفوض].
    ثم اذكر الأسباب والتفاصيل في الأسطر التالية.
    `;

    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: 'You are an administrative assistant for a Discord Roleplay community.' },
                { role: 'user', content: prompt }
            ],
            model: 'llama3-70b-8192',
            temperature: 0.1,
        });

        const aiResponse = chatCompletion.choices[0]?.message?.content || 'لم يتمكن الذكاء الاصطناعي من إصدار تقرير.';
        const isAccepted = aiResponse.includes('[مقبول]');
        const robloxUsername = answers[2].answer.trim();

        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(user.id);

        if (isAccepted) {
            // حالة القبول التلقائي من الذكاء الاصطناعي
            try {
                const uniqueId = await generateUniqueId(guild);
                const newNickname = `NA | ${robloxUsername} | ${uniqueId}`;

                await member.setNickname(newNickname);
                if (ROLE_ID) await member.roles.add(ROLE_ID);

                const acceptEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle(`✅ تقديم مقبول تلقائياً: ${user.tag}`)
                    .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL({ dynamic: true }) })
                    .setDescription(`**تحليل الذكاء الاصطناعي:**\n${aiResponse}`)
                    .addFields(
                        { name: 'الاسم الجديد', value: `\`${newNickname}\`` },
                        { name: 'ايدي المستخدم', value: user.id, inline: true }
                    )
                    .setFooter({ text: 'مقبول تلقائياً بواسطة الذكاء الاصطناعي' });

                // زر الرفض اليدوي للإدارة
                const rejectButton = new ButtonBuilder()
                    .setCustomId(`manual_reject_${user.id}_${robloxUsername}`)
                    .setLabel('رفض يدوي ❌')
                    .setStyle(ButtonStyle.Danger);

                const row = new ActionRowBuilder().addComponents(rejectButton);

                const acceptLogChannel = await client.channels.fetch(ACCEPT_LOG_CHANNEL_ID);
                if (acceptLogChannel) {
                    await acceptLogChannel.send({ embeds: [acceptEmbed], components: [row] });
                }

            } catch (err) {
                console.error('حدث خطأ أثناء إجراءات القبول:', err);
            }

        } else {
            // حالة الرفض التلقائي من الذكاء الاصطناعي
            const rejectEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle(`❌ تقديم مرفوض تلقائياً: ${user.tag}`)
                .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL({ dynamic: true }) })
                .setDescription(`**تحليل الذكاء الاصطناعي:**\n${aiResponse}`)
                .addFields(
                    { name: 'ايدي المستخدم', value: user.id, inline: true }
                )
                .setFooter({ text: 'مرفوض تلقائياً بواسطة الذكاء الاصطناعي' });

            // زر القبول اليدوي للإدارة
            const acceptButton = new ButtonBuilder()
                .setCustomId(`manual_accept_${user.id}_${robloxUsername}`)
                .setLabel('قبول يدوي ✅')
                .setStyle(ButtonStyle.Success);

            const row = new ActionRowBuilder().addComponents(acceptButton);

            const rejectLogChannel = await client.channels.fetch(REJECT_LOG_CHANNEL_ID);
            if (rejectLogChannel) {
                await rejectLogChannel.send({ embeds: [rejectEmbed], components: [row] });
            }
        }

    } catch (error) {
        console.error('خطأ في الاتصال بـ Groq API:', error);
    }
}

client.login(DISCORD_TOKEN);
        
