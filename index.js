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
//       نظام المخالفات
// ==============================

const {
    violationCommand,
    handleViolationCommand,
    handleViolationSelect,
    handleViolationPaid
} = require('./violations');

// ==============================
//           الإعدادات
// ==============================

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const ACCEPT_LOG_CHANNEL_ID =
    process.env.ACCEPT_LOG_CHANNEL_ID ||
    process.env.LOG_CHANNEL_ID ||
    '1521844992811728906';

const REJECT_LOG_CHANNEL_ID =
    process.env.REJECT_LOG_CHANNEL_ID ||
    process.env.LOG_CHANNEL_ID ||
    '1521845037535854642';

// روم بانل التقديم
const PANEL_CHANNEL_ID = '1521392423279005736';

// رتبة التصريح
const ROLE_ID = process.env.ROLE_ID;

// روم أوامر الرول بلاي
const TARGET_CHANNEL_ID = '1510857986778726641';

// ==============================
//        تشغيل البوت
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

// ==============================
//             Groq
// ==============================

let groq = null;

if (GROQ_API_KEY && GROQ_API_KEY.trim() !== '') {
    try {
        groq = new Groq({
            apiKey: GROQ_API_KEY
        });

        console.log('✅ تم تهيئة Groq SDK بنجاح.');
    } catch (error) {
        console.error(
            '❌ خطأ في تهيئة Groq SDK:',
            error.message
        );
    }
} else {
    console.warn(
        '⚠️ GROQ_API_KEY غير متوفر!'
    );
}

// ==============================
//       جلسات التقديم
// ==============================

const applySessions = new Map();

// ==============================
//          أسئلة التقديم
// ==============================

const applyQuestions = [
    {
        id: 'q1',
        text: '1/5. الاسم الكريم'
    },
    {
        id: 'q2',
        text: '2/5. عمرك'
    },
    {
        id: 'q3',
        text: '3/5. اسم حسابك روب الأساسي'
    },
    {
        id: 'q4',
        text: '4/5. اختصار حسابك'
    },
    {
        id: 'q5',
        text:
            '5/5. اقسم بالله العظيم أنا (فلان) لن اخرب رولات مجتمع النظيم وان احترم الجميع وان احترم الاداره ولا اطول لساني عليهم و احترم جميع أعضاء السيرفر والله على ما اقوله شهيد.\n\n' +
            '(اكتب القسم كاملاً كما هو)'
    }
];

// ==============================
//       تسجيل الأوامر
// ==============================

const commands = [
    violationCommand,

    new SlashCommandBuilder()
        .setName('roleplay')
        .setDescription('إرسال إعلان الرول بلاي')
        .addStringOption(option =>
            option
                .setName('حسابك_روبلوكس')
                .setDescription(
                    'ادخل اسم حساب الهوست في روبلوكس'
                )
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('وقت_بداية_الرول')
                .setDescription(
                    'ادخل وقت بداية الرول'
                )
                .setRequired(true)
        ),

    new SlashCommandBuilder()
        .setName('rate')
        .setDescription(
            'إرسال رسالة تقييم الرول'
        ),

    new SlashCommandBuilder()
        .setName('vote')
        .setDescription(
            'إرسال رسالة تصويت لفتح الرول بلاي'
        ),

    new SlashCommandBuilder()
        .setName('schedule')
        .setDescription(
            'إرسال أوقات الرول بلاي عند عدم وجود منظم'
        ),

    new SlashCommandBuilder()
        .setName('setup-apply')
        .setDescription(
            'إنشاء بانل التقديم'
        )
].map(command => command.toJSON());

// ==============================
//       تسجيل الأوامر
// ==============================

if (DISCORD_TOKEN && CLIENT_ID) {
    const rest = new REST({
        version: '10'
    }).setToken(DISCORD_TOKEN);

    (async () => {
        try {
            console.log(
                'جاري تسجيل الأوامر...'
            );

            await rest.put(
                Routes.applicationCommands(
                    CLIENT_ID
                ),
                {
                    body: commands
                }
            );

            console.log(
                'تم تسجيل جميع الأوامر بنجاح!'
            );
        } catch (error) {
            console.error(
                'حدث خطأ أثناء تسجيل الأوامر:',
                error.message
            );
        }
    })();
}

// ==============================
//       توليد ID عشوائي
// ==============================

async function generateUniqueId(guild) {
    try {
        await guild.members.fetch();
    } catch (error) {
        console.error(
            'خطأ في جلب الأعضاء:',
            error.message
        );
    }

    let randomId = '';

    while (true) {
        randomId = Math.floor(
            100000 + Math.random() * 900000
        ).toString();

        const exists =
            guild.members.cache.some(
                member =>
                    member.nickname &&
                    member.nickname.includes(
                        randomId
                    )
            );

        if (!exists) {
            return randomId;
        }
    }
}

// ==============================
//       إرسال سؤال بالخاص
// ==============================

async function sendDMQuestion(
    channel,
    questionText
) {
    const embed =
        new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('📝 سؤال التقديم')
            .setDescription(questionText)
            .setFooter({
                text:
                    'يرجى كتابة الإجابة هنا في الرسائل الخاصة'
            });

    await channel.send({
        embeds: [embed]
    });
}

// ==============================
//       بدء التقديم
// ==============================

async function startApplicationProcess(
    user,
    interaction = null
) {
    const userId = user.id;

    if (applySessions.has(userId)) {
        const message =
            'لديك جلسة تقديم جارية بالفعل في الخاص.';

        if (interaction) {
            return interaction.reply({
                content: message,
                ephemeral: true
            });
        }

        return;
    }

    try {
        const dmChannel =
            await user.createDM();

        const startEmbed =
            new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(
                    '📝 بدء تقديم تصريح مجتمع النظيم'
                )
                .setDescription(
                    'نحن سعداء بتقدملك لمجتمع النظيم.\n' +
                    'يرجى الإجابة على الأسئلة التالية بعناية، سيتم مراجعة إجاباتك بواسطة الذكاء الاصطناعي.\n\n' +
                    'أرسل إجاباتك كرسائل عادية في هذه المحادثة.'
                )
                .setTimestamp();

        await dmChannel.send({
            embeds: [startEmbed]
        });

        await sendDMQuestion(
            dmChannel,
            applyQuestions[0].text
        );

        applySessions.set(userId, {
            currentQuestionIndex: 0,
            answers: [],
            dmChannelId: dmChannel.id
        });

        if (interaction) {
            await interaction.reply({
                content:
                    'تم بدء التقديم! يرجى التحقق من الرسائل الخاصة بك (DM).',
                ephemeral: true
            });
        }
    } catch (error) {
        console.error(
            'خطأ في بدء التقديم:',
            error.message
        );

        if (interaction) {
            await interaction.reply({
                content:
                    'لا يمكنني بدء التقديم. يرجى التأكد من فتح الرسائل الخاصة (DM).',
                ephemeral: true
            });
        }
    }
}

// ==============================
//      التفاعلات
// ==============================

client.once('clientReady', () => {
    console.log(
        `تم تشغيل البوت بنجاح باسم: ${client.user.tag}`
    );
});

client.on(
    'interactionCreate',
    async interaction => {
        try {

            // ==========================
            //       Select Menu
            // ==========================

            if (
                interaction.isStringSelectMenu()
            ) {
                if (
                    interaction.customId.startsWith(
                        'violation_select:'
                    )
                ) {
                    return await handleViolationSelect(
                        interaction
                    );
                }

                return;
            }

            // ==========================
            //          Buttons
            // ==========================

            if (interaction.isButton()) {

                const customId =
                    interaction.customId;

                // ==========================
                //      تسديد المخالفة
                // ==========================

                if (
                    customId.startsWith(
                        'violation_paid:'
                    )
                ) {
                    return await handleViolationPaid(
                        interaction
                    );
                }

                // ==========================
                //       بدء التقديم
                // ==========================

                if (
                    customId ===
                    'start_apply_button'
                ) {
                    return await startApplicationProcess(
                        interaction.user,
                        interaction
                    );
                }

                // ==========================
                //      قبول / رفض يدوي
                // ==========================

                if (
                    customId.startsWith(
                        'manual_accept_'
                    ) ||
                    customId.startsWith(
                        'manual_reject_'
                    )
                ) {

                    const parts =
                        customId.split('_');

                    const action =
                        parts[1];

                    const targetUserId =
                        parts[2];

                    const robloxName =
                        parts
                            .slice(3)
                            .join('_') ||
                        'User';

                    let guild;

                    try {
                        guild =
                            await client.guilds.fetch(
                                GUILD_ID
                            );
                    } catch (error) {
                        return interaction.reply({
                            content:
                                'تعذر الوصول للسيرفر.',
                            ephemeral: true
                        });
                    }

                    let member;

                    try {
                        member =
                            await guild.members.fetch(
                                targetUserId
                            );
                    } catch (error) {
                        return interaction.reply({
                            content:
                                'تعذر العثور على العضو في السيرفر.',
                            ephemeral: true
                        });
                    }

                    // ==========================
                    //          قبول
                    // ==========================

                    if (
                        action ===
                        'accept'
                    ) {

                        const uniqueId =
                            await generateUniqueId(
                                guild
                            );

                        const newNickname =
                            `NA | ${robloxName} | ${uniqueId}`;

                        await member
                            .setNickname(
                                newNickname
                            )
                            .catch(error =>
                                console.log(
                                    'تعذر تغيير الاسم:',
                                    error.message
                                )
                            );

                        if (ROLE_ID) {
                            await member.roles
                                .add(ROLE_ID)
                                .catch(error =>
                                    console.log(
                                        'تعذر إضافة الرتبة:',
                                        error.message
                                    )
                                );
                        }

                        const updatedEmbed =
                            EmbedBuilder
                                .from(
                                    interaction
                                        .message
                                        .embeds[0]
                                )
                                .setColor(
                                    0x00FF00
                                )
                                .setTitle(
                                    `✅ تم القبول يدوياً بواسطة: ${interaction.user.tag}`
                                )
                                .addFields({
                                    name:
                                        'الاسم الجديد',
                                    value:
                                        `\`${newNickname}\``
                                });

                        return interaction.update({
                            embeds: [
                                updatedEmbed
                            ],
                            components: []
                        });
                    }

                    // ==========================
                    //          رفض
                    // ==========================

                    if (
                        action ===
                        'reject'
                    ) {

                        await member
                            .setNickname(null)
                            .catch(() => {});

                        if (ROLE_ID) {
                            await member.roles
                                .remove(
                                    ROLE_ID
                                )
                                .catch(() => {});
                        }

                        const updatedEmbed =
                            EmbedBuilder
                                .from(
                                    interaction
                                        .message
                                        .embeds[0]
                                )
                                .setColor(
                                    0xFF0000
                                )
                                .setTitle(
                                    `❌ تم الرفض يدوياً بواسطة: ${interaction.user.tag}`
                                );

                        return interaction.update({
                            embeds: [
                                updatedEmbed
                            ],
                            components: []
                        });
                    }

                    return;
                }

                return;
            }

            // ==========================
            //       Slash Commands
            // ==========================

            if (
                !interaction.isChatInputCommand()
            ) {
                return;
            }

            // ==========================
            //         المخالفات
            // ==========================

            if (
                interaction.commandName ===
                'mukhalafa'
            ) {
                return await handleViolationCommand(
                    interaction
                );
            }

            // ==========================
            //        setup-apply
            // ==========================

            if (
                interaction.commandName ===
                'setup-apply'
            ) {

                if (
                    interaction.channelId !==
                    PANEL_CHANNEL_ID
                ) {
                    return interaction.reply({
                        content:
                            `لا يمكنك استخدام هذا الأمر إلا في روم البانل <#${PANEL_CHANNEL_ID}>!`,
                        ephemeral: true
                    });
                }

                const panelEmbed =
                    new EmbedBuilder()
                        .setColor(
                            0x2F3136
                        )
                        .setTitle(
                            '📝 تقديم تصريح مجتمع النظيم'
                        )
                        .setDescription(
                            'مرحباً بك! لتقديم طلب الحصول على تصريح داخل السيرفر، اضغط على الزر أدناه للبدء.\n\n' +
                            '⚠️ **ملاحظة:** سيقوم البوت بالتواصل معك في الرسائل الخاصة (DM) لطرح الأسئلة ومراجعتها بواسطة الذكاء الاصطناعي.'
                        )
                        .setFooter({
                            text:
                                'مجتمع النظيم للعب الواقعي'
                        });

                const applyButton =
                    new ButtonBuilder()
                        .setCustomId(
                            'start_apply_button'
                        )
                        .setLabel(
                            'بدء التقديم 📝'
                        )
                        .setStyle(
                            ButtonStyle.Success
                        );

                const row =
                    new ActionRowBuilder()
                        .addComponents(
                            applyButton
                        );

                await interaction.channel.send({
                    embeds: [
                        panelEmbed
                    ],
                    components: [
                        row
                    ]
                });

                return interaction.reply({
                    content:
                        'تم إنشاء بانل التقديم بنجاح!',
                    ephemeral: true
                });
            }

            // ==========================
            //       أوامر الرول بلاي
            // ==========================

            if (
                interaction.channelId !==
                TARGET_CHANNEL_ID
            ) {
                return interaction.reply({
                    content:
                        'لا يمكنك استخدام هذا الأمر إلا في الروم المخصص له!',
                    ephemeral: true
                });
            }

            // ==========================
            //          roleplay
            // ==========================

            if (
                interaction.commandName ===
                'roleplay'
            ) {

                const hostAccount =
                    interaction.options.getString(
                        'حسابك_روبلوكس'
                    );

                const startTime =
                    interaction.options.getString(
                        
                    );

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

                return interaction.reply({
                    content:
                        responseText
                });
            }

            // ==========================
            //             rate
            // ==========================

            if (
                interaction.commandName ===
                'rate'
            ) {

                const rateText =
`__**تقييم رولي**__

__**اذا عجبك رول صوت ✅**__

__**شكراً لتصويتك هذا يساعدنا نفتح الرول بلاي ماقصرتو**__

__**اذا ماعجبك رول حط ❌**__

**__ لو تحط صح وانت مبلك تايم 1h__**

@everyone`;

                const replyMessage =
                    await interaction.reply({
                        content:
                            rateText,
                        fetchReply: true
                    });

                try {
                    await replyMessage.react(
                        '✅'
                    );

                    await replyMessage.react(
                        '❌'
                    );
                } catch (error) {
                    console.error(
                        'خطأ في إرسال الريأكشن:',
                        error.message
                    );
                }

                return;
            }

            // ==========================
            //             vote
            // ==========================

            if (
                interaction.commandName ===
                'vote'
            ) {

                const voteText =
`__**تصويت رول بلاي**__

__**في حال تبي رول بلاي صوت ب ✅**__

__**شكراً لتصويتك هذا يساعدنا نفتح الرول بلاي ماقصرتو**__

@everyone`;

                const replyMessage =
                    await interaction.reply({
                        content:
                            voteText,
                        fetchReply: true
                    });

                try {
                    await replyMessage.react(
                        '✅'
                    );
                } catch (error) {
                    console.error(
                        'خطأ في إرسال الريأكشن:',
                        error.message
                    );
                }

                return;
            }

            // ==========================
            //          schedule
            // ==========================

            if (
                interaction.commandName ===
                'schedule'
            ) {

                const scheduleText =
`__**اوقات رول بلاي**__

__**من الساعه 12 الظهر الى 2**__

__**من الساعه 4 العصر الى 6**__

__**من الساعه 8 العشاء الى 10**__

__**من الساعه 1 الليل الى 3**__

@everyone`;

                return interaction.reply({
                    content:
                        scheduleText
                });
            }

        } catch (error) {

            console.error(
                'خطأ أثناء تنفيذ التفاعل:',
                error
            );

            if (
                !interaction.replied &&
                !interaction.deferred
            ) {
                try {
                    await interaction.reply({
                        content:
                            '❌ حدث خطأ أثناء تنفيذ الأمر.',
                        ephemeral: true
                    });
                } catch {}
            }
        }
    }
);

// ==============================
//      استقبال إجابات DM
// ==============================

client.on(
    'messageCreate',
    async message => {

        if (
            message.author.bot ||
            message.channel.type !==
                ChannelType.DM
        ) {
            return;
        }

        const userId =
            message.author.id;

        const session =
            applySessions.get(
                userId
            );

        if (!session) {
            return;
        }

        const currentQuestion =
            applyQuestions[
                session.currentQuestionIndex
            ];

        if (!currentQuestion) {
            return;
        }

        session.answers.push({
            question:
                currentQuestion.text,
            answer:
                message.content
        });

        session.currentQuestionIndex++;

        if (
            session.currentQuestionIndex <
            applyQuestions.length
        ) {

            await sendDMQuestion(
                message.channel,
                applyQuestions[
                    session.currentQuestionIndex
                ].text
            );

        } else {

            const finishingEmbed =
                new EmbedBuilder()
                    .setColor(
                        0xFF9900
                    )
                    .setTitle(
                        '⏳ تم استلام إجاباتك بنجاح'
                    )
                    .setDescription(
                        'جاري مراجعة إجاباتك الآن وإرسال التقرير للإدارة...\nشكراً لصبرك.'
                    );

            await message.channel.send({
                embeds: [
                    finishingEmbed
                ]
            });

            const userAnswers =
                [...session.answers];

            applySessions.delete(
                userId
            );

            processApplication(
                message.author,
                userAnswers
            ).catch(error => {
                console.error(
                    'خطأ في processApplication:',
                    error.message
                );
            });
        }
    }
);

// ==============================
//    معالجة التقديم والذكاء
// ==============================

async function processApplication(
    user,
    answers
) {

    const formattedAnswers =
        answers
            .map(
                (answer, index) =>
                    `س${index + 1}: ${answer.question}\nج${index + 1}: ${answer.answer}`
            )
            .join('\n\n');

    let aiResponse = '';
    let isAccepted = false;
    let aiFailed = false;

    const prompt =
`
أنت مساعد إداري في سيرفر ديسكورد للعب الواقعي (Roleplay) في مجتمع "النظيم".

مهمتك هي مراجعة تقديم تصريح لمستخدم جديد.

المستخدم: ${user.tag} (الايدي: ${user.id})

الإجابات المقدمة:
${formattedAnswers}

الشروط للقبول:
1. الاسم جاد وحقيقي وليس وهمياً.
2. اسم حساب روبلوكس مكتوب بوضوح.
3. كتب القسم كاملاً وبدقة في السؤال 5 بدون تحريف أو نقص كبير.

تنبيه هام جداً:
يجب أن تكون إجابتك تبدأ بكلمة مقبول أو كلمة مرفوض في أول السطر.
`;

    try {

        if (!groq) {
            throw new Error(
                'مكتبة Groq غير مهيأة أو مفتاح GROQ_API_KEY مفقود'
            );
        }

        const chatCompletion =
            await groq.chat.completions.create({
                messages: [
                    {
                        role: 'system',
                        content:
                            'You are an administrative assistant. Start response strictly with "مقبول" or "مرفوض".'
                    },
                    {
                        role: 'user',
                        content:
                            prompt
                    }
                ],
                model:
                    'llama-3.3-70b-versatile',
                temperature: 0.1
            });

        aiResponse =
            chatCompletion
                .choices[0]
                ?.message
                ?.content ||
            'مرفوض\nلم يتم استلام رد من الذكاء الاصطناعي.';

        const cleanResponse =
            aiResponse.trim();

        isAccepted =
            cleanResponse.startsWith(
                'مقبول'
            );

    } catch (error) {

        console.error(
            '❌ خطأ في Groq API:',
            error.message
        );

        aiFailed = true;

        aiResponse =
            `⚠️ خطأ في التقييم التلقائي: ${error.message}`;
    }

    const robloxUsername =
        answers[2]?.answer
            ? answers[2].answer.trim()
            : user.username;

    let guild = null;

    try {

        if (GUILD_ID) {
            guild =
                await client.guilds.fetch(
                    GUILD_ID
                );
        }

    } catch (error) {

        console.error(
            '⚠️ تعذر العثور على السيرفر:',
            error.message
        );
    }

    let member = null;

    if (guild) {

        try {

            member =
                await guild.members.fetch(
                    user.id
                );

        } catch (error) {

            console.error(
                '⚠️ تعذر جلب العضو:',
                error.message
            );
        }
    }

    // ==============================
    //             قبول
    // ==============================

    if (
        !aiFailed &&
        isAccepted
    ) {

        let newNickname = '';

        if (guild) {

            const uniqueId =
                await generateUniqueId(
                    guild
                );

            newNickname =
                `NA | ${robloxUsername} | ${uniqueId}`;
        }

        if (member) {

            await member
                .setNickname(
                    newNickname
                )
                .catch(error =>
                    console.error(
                        '⚠️ تعذر تغيير الاسم:',
                        error.message
                    )
                );

            if (ROLE_ID) {

                await member.roles
                    .add(
                        ROLE_ID
                    )
                    .catch(error =>
                        console.error(
                            '⚠️ تعذر إضافة الرتبة:',
                            error.message
                        )
                    );
            }
        }

        try {

            const dmChannel =
                await user.createDM();

            await dmChannel.send(
                '🎉 **تهانينا!** تم قبول تقديمك في **مجتمع النظيم** بنجاح.'
            );

        } catch {}

        const acceptEmbed =
            new EmbedBuilder()
                .setColor(
                    0x00FF00
                )
                .setTitle(
                    `✅ تقديم مقبول تلقائياً: ${user.tag}`
                )
                .setAuthor({
                    name:
                        user.tag,
                    iconURL:
                        user.displayAvatarURL({
                            dynamic: true
                        })
                })
                .setDescription(
                    `**تحليل الذكاء الاصطناعي:**\n${aiResponse}`
                )
                .addFields(
                    {
                        name:
                            'الاسم الجديد',
                        value:
                            `\`${newNickname || 'غير متاح'}\``
                    },
                    {
                        name:
                            'ايدي المستخدم',
                        value:
                            user.id,
                        inline: true
                    }
                )
                .setFooter({
                    text:
                        'مقبول تلقائياً بواسطة الذكاء الاصطناعي'
                });

        const rejectButton =
            new ButtonBuilder()
                .setCustomId(
                    `manual_reject_${user.id}_${robloxUsername}`
                )
                .setLabel(
                    'رفض يدوي ❌'
                )
                .setStyle(
                    ButtonStyle.Danger
                );

        const row =
            new ActionRowBuilder()
                .addComponents(
                    rejectButton
                );

        await sendToLogChannel(
            ACCEPT_LOG_CHANNEL_ID,
            {
                embeds: [
                    acceptEmbed
                ],
                components: [
                    row
                ]
            }
        );

    } else {

        // ==============================
        //             رفض
        // ==============================

        try {

            const dmChannel =
                await user.createDM();

            await dmChannel.send(
                `❌ **عذراً!** تم رفض تقديمك في **مجتمع النظيم**.\n\n**السبب:**\n${aiResponse}`
            );

        } catch {}

        const rejectEmbed =
            new EmbedBuilder()
                .setColor(
                    aiFailed
                        ? 0xFFA500
                        : 0xFF0000
                )
                .setTitle(
                    aiFailed
                        ? `⚠️ تقديم يحتاج مراجعة يدوية: ${user.tag}`
                        : `❌ تقديم مرفوض تلقائياً: ${user.tag}`
                )
                .setAuthor({
                    name:
                        user.tag,
                    iconURL:
                        user.displayAvatarURL({
                            dynamic: true
                        })
                })
                .setDescription(
                    `**تحليل الذكاء الاصطناعي:**\n${aiResponse}`
                )
                .addFields({
                    name:
                        'ايدي المستخدم',
                    value:
                        user.id,
                    inline: true
                })
                .setFooter({
                    text:
                        'مراجعة التقديم'
                });

        const acceptButton =
            new ButtonBuilder()
                .setCustomId(
                    `manual_accept_${user.id}_${robloxUsername}`
                )
                .setLabel(
                    'قبول يدوي ✅'
                )
                .setStyle(
                    ButtonStyle.Success
                );

        const row =
            new ActionRowBuilder()
                .addComponents(
                    acceptButton
                );

        await sendToLogChannel(
            REJECT_LOG_CHANNEL_ID,
            {
                embeds: [
                    rejectEmbed
                ],
                components: [
                    row
                ]
            }
        );
    }
}

// ==============================
//          إرسال اللوج
// ==============================

async function sendToLogChannel(
    channelId,
    messageOptions
) {

    if (!channelId) {
        console.error(
            '❌ لم يتم توفير channelId.'
        );
        return;
    }

    try {

        const logChannel =
            await client.channels.fetch(
                channelId
            );

        if (!logChannel) {
            console.error(
                `❌ لم يتم العثور على القناة: ${channelId}`
            );
            return;
        }

        await logChannel.send(
            messageOptions
        );

        console.log(
            `✅ تم إرسال التقرير إلى القناة: ${channelId}`
        );

    } catch (error) {

        console.error(
            `❌ فشل إرسال اللوج إلى القناة (${channelId}):`,
            error.message
        );
    }
}

// ==============================
//       HTTP Server لـ Render
// ==============================

const http =
    require('http');

const PORT =
    process.env.PORT || 10000;

const server =
    http.createServer(
        (req, res) => {

            res.writeHead(
                200,
                {
                    'Content-Type':
                        'text/plain'
                }
            );

            res.end(
                'Discord Bot is Online!'
            );
        }
    );

server.listen(
    PORT,
    '0.0.0.0',
    () => {

        console.log(
            `HTTP Server running on port ${PORT}`
        );
    }
);

// ==============================
//           Login
// ==============================

if (DISCORD_TOKEN) {

    client.login(
        DISCORD_TOKEN
    );

} else {

    console.error(
        '❌ DISCORD_TOKEN غير موجود في متغيرات البيئة!'
    );
    }
