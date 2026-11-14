/* ==========================================================================
   THE WRITERS' ROOM
   Every line here is a template. The director (app.js) picks from these with
   a seed made from today's date, so the film changes every day.

   Roles:  H = host, S = sidekick, G = guest, N = stage direction (narrator)
   Tokens: {city} {greeting} {H} {S} {Sfirst} {G} {Gfull} {Hhon} {Hyoung}
           {Sexclaim} {temp} {feels} {hi} {lo} {wind} {gust} {windDir} {hum}
           {pop} {uv} {sunset} {sunrise} {tCond} {tHi} {tLo} {tPop}
           {bestDay} {worstDay} {tempQuip}
   Optional third item in a line = an action: flash, shake, enter, exit,
   fish, sheep, lightsout, hop:S, hop:H, hop:G
   ========================================================================== */

const SHOW_NAME = 'The Weather, Unfortunately';
const SHOW_TAGLINE = "Britain's least reliable forecast, delivered by its most unreliable people.";

const SETTINGS = [
  { id: 'studio',   name: 'Studio 4B, The Weather Wing',             outdoor: false },
  { id: 'castle',   name: 'The Battlements of Castle Drench',        outdoor: true  },
  { id: 'field',    name: 'A Muddy Field Somewhere Near Slough',     outdoor: true  },
  { id: 'ministry', name: 'The Ministry of Weather, Room 23',        outdoor: false },
  { id: 'pier',     name: 'The End of the Pier, Skegby-on-Sea',      outdoor: true  },
  { id: 'parlour',  name: 'A Drawing Room of Unnecessary Size',      outdoor: false },
];

const TITLES = {
  clear:   ['The Big Yellow Thing Returns', 'In Which Nobody Has Anything To Complain About (They Find Something)',
            'A Scorcher, Allegedly', 'Blue Skies and Sinister Motives', 'The Sun Also Rises (Briefly)'],
  night:   ['Stars, Darkness and Mild Disappointment', 'A Clear Night for Skulking', 'The Moon Looks On, Unimpressed'],
  cloudy:  ['Fifty Shades of Grey Sky', 'The Overcast and the Furious', 'Clouds of Glory, Mostly Beige',
            'A Ceiling of Porridge', 'In Which the Sun Has a Lie-In'],
  fog:     ['Where Did Everyone Go?', 'The Mist Opportunity', 'Pea Soup and Peril', 'Murk Most Foul'],
  drizzle: ["In Which It Doesn't Quite Rain", 'The Spittle of Heaven', 'Mizzle Most Foul', 'A Damp Squib'],
  rain:    ['In Which It Rains, Obviously', 'The Wet Ones', 'Soggy Bottoms and Stiff Upper Lips',
            'A Grand Day for Ducks', 'Brollies at Dawn'],
  snow:    ['The Big Freeze (Trains Cancelled)', 'Snow Laughing Matter', 'Slush Fund', 'The Wrong Kind of Snow'],
  thunder: ['Sound and Fury, Mostly Fury', 'The Clouds Are Fighting Again', 'A Shocking Business', 'Bang Goes the Picnic'],
};

const GREETINGS = {
  morning: ['Good morning', 'Morning', 'Good morning, if that is the word'],
  afternoon: ['Good afternoon', 'Afternoon', 'Good afternoon, or what passes for one'],
  evening: ['Good evening', 'Evening', 'Good evening, such as it is'],
  night: ['Good grief, it is late', 'Good evening, insomniacs', 'Hello, night owls and burglars'],
};

/* ---------------- OPENINGS (host) ---------------- */
const OPENINGS = [
  [['H', "{greeting}, {city}. I'm {H}, and once again I have been forced, at sword-point, to tell you about the sky."]],
  [['H', "{greeting} and welcome to the weather — the bit between the news and the programme you actually wanted to watch."]],
  [['H', "{greeting}, {city}. The weather is out there, as usual, doing exactly as it pleases. Much like my staff."]],
  [['H', "{greeting}. I'm {H}. I was promised a career in Shakespeare. Instead: clouds."]],
  [['H', "{greeting}, {city}. Tonight's forecast has been prepared by experts, checked by idiots, and is delivered, regrettably, by me."]],
  [['H', "{greeting}. Before we begin, I'd like to apologise for the weather. Not personally. I simply feel someone ought to."]],
  [['H', "{greeting}, {city}. Welcome to the forecast. Please keep your arms inside the vehicle and your expectations low."]],
];

/* ---------------- SIDEKICK INTRODUCTIONS ---------------- */
const SIDEKICK_INTROS = [
  [['H', "Joining me, as ever, is {S}, a man whose brain could rattle around inside a thimble and still complain about the draught."],
   ['S', "{Sexclaim}! Thank you, {Hhon}!"]],
  [['H', "With me tonight is {S}. Say hello, {Sfirst}."],
   ['S', "Hello!"],
   ['H', "Marvellous. That's his entire vocabulary for the evening, so do cherish it."]],
  [['H', "I'm joined by my assistant, {S}, who has the intellect of a damp crumpet and roughly the same complexion."],
   ['S', "I'm buttered on both sides, me."],
   ['H', "Nobody asked, {Sfirst}."]],
  [['H', "As always, I'm accompanied by {S}. Don't wave, {Sfirst}. They can't see you."],
   ['S', "Can't they?"],
   ['H', "Nobody can ever see you, {Sfirst}. It's the one mercy of your existence."]],
  [['S', "{Sexclaim}! Are we on?"],
   ['H', "Yes, {Sfirst}. We are on. We have been on for some time. That's {S}, everybody. Try not to make eye contact."]],
];

/* ---------------- CURRENT CONDITIONS ---------------- */
const CONDITIONS = {
  clear: [
    [['H', "Right now in {city} it's {temp}, and the sky is completely, offensively clear."],
     ['S', "{Sexclaim}! Is that good?"],
     ['H', "It's sunshine, {Sfirst}. It's what the rest of the year is for complaining about the absence of."]],
    [['H', "Currently {temp} and sunny. Feels like {feels}."],
     ['S', "What's that big yellow thing, {Hhon}?"],
     ['H', "That is the sun, {Sfirst}."],
     ['S', "Is it dangerous?"],
     ['H', "Only to people who stare at it. So find something else to do. Breathing, for instance. Practise that."]],
    [['H', "It's {temp} and bright — the sort of day on which the British public removes its shirt immediately and regrets it by teatime."],
     ['S', "{tookOff}"],
     ['H', "Yes. We noticed. Several people have written in."]],
  ],
  night: [
    [['H', "It's a clear night over {city}, {temp}, and the stars are out."],
     ['S', "Which ones?"],
     ['H', "All of them, {Sfirst}. They don't do shifts."]],
    [['H', "Clear skies tonight, {temp}, feeling like {feels}. A perfect night for astronomy, romance, or burglary."],
     ['S', "{Sexclaim}! Which one are we doing?"],
     ['H', "In your case, {Sfirst}, I'd keep an eye on the silverware."]],
  ],
  cloudy: [
    [['H', "It's {temp} and overcast. The sky looks like a mattress that's been left out behind a pub."],
     ['S', "Ooh, I'd sleep on that."],
     ['H', "I don't doubt it, {Sfirst}. I suspect you already have."]],
    [['H', "Grey skies over {city} at {temp}. The clouds have arrived, unpacked, and are clearly planning to stay the week. Like relatives."],
     ['S', "{Sexclaim}! Can we get rid of 'em?"],
     ['H', "Only by pretending to be out. Which, incidentally, is how the British summer works."]],
    [['H', "Currently {temp}, cloudy, and the sun has been reported missing. Police are not looking for it."],
     ['S', "Why not?"],
     ['H', "Because it's {city}, {Sfirst}. They assume it's emigrated."]],
  ],
  fog: [
    [['H', "There's fog in {city} at {temp}. Visibility is so poor I can barely see {Sfirst}."],
     ['S', "I'm right here!"],
     ['H', "Yes. It was nice while it lasted."]],
    [['H', "Thick fog this morning, {temp}. If a dark shape looms at you out of the murk, don't panic."],
     ['S', "Why not?"],
     ['H', "It's probably a bus. Actually, panic would be entirely appropriate. Disregard."]],
  ],
  drizzle: [
    [['H', "It's {temp} and drizzling. Drizzle, for our overseas viewers, is rain that lacks the courage of its convictions."],
     ['S', "Like me, {Hhon}!"],
     ['H', "No, {Sfirst}. Drizzle has convictions. You have a caution for being drunk in charge of a goat."]],
    [['H', "A fine drizzle over {city}, {temp}. Not enough to justify an umbrella. Just enough to ruin your hair, your shoes and your will to live."],
     ['S', "I like drizzle. It's like being licked by a very shy cow."],
     ['N', "[A long, terrible pause]"],
     ['H', "...We'll move on."]],
  ],
  rain: [
    [['H', "It is raining in {city}. It's {temp}, and the rain is coming down like a bailiff with a grudge."],
     ['S', "{Sexclaim}! I left {me} washing out!"],
     ['H', "Well, now it's being washed again, free of charge. You should be grateful."]],
    [['H', "Heavy rain at the moment, {temp}. The sort of rain that gets into your shoes, your collar, and eventually your soul."],
     ['S', "I've got a brilliant idea, {Hhon}!"],
     ['H', "Oh, God."],
     ['S', "What if... we all went inside?"],
     ['H', "{Sfirst}, that is the first sensible thing you have said in eleven years. Ignore it, everybody. It was a fluke."]],
    [['H', "It's {temp} and wet. Very wet. Wetter than a haddock's bathing costume."],
     ['S', "Do haddocks wear bathing costumes?"],
     ['H', "Only the modest ones, {Sfirst}."]],
  ],
  snow: [
    [['H', "It's snowing! {temp}. The nation's transport network will now collapse in a heap, like a Victorian lady who's glimpsed an ankle."],
     ['S', "I love snow! I'm going to build a snowman!"],
     ['H', "Good. Make him intelligent. You could do with the company."]],
    [['H', "Snow in {city}, {temp}. Children are delighted. Adults are working out exactly how late they'll be."],
     ['S', "{Sexclaim}! Can I have a snow day?"],
     ['H', "Every day is a snow day for you, {Sfirst}. Nothing happens and nobody expects you to turn up."]],
  ],
  thunder: [
    [['H', "Thunderstorms over {city}, {temp}. If you hear a loud bang, that's the thunder."],
     ['N', "[CRASH]", 'flash'],
     ['S', "AAAAARGH!", 'hop:S'],
     ['H', "And that was {Sfirst}."]],
    [['H', "Lightning in the area, {temp}. Please avoid standing in open fields holding metal objects."],
     ['S', "What about a sword?"],
     ['H', "Especially a sword, {Sfirst}. Unless the sword is mine and the target is you."]],
  ],
};

/* ---------------- TEMPERATURE QUIPS (host) ---------------- */
const TEMP_QUIPS = {
  freezing: ["it's colder than a tax inspector's handshake.",
             "it's cold enough to freeze the opinions off a vicar.",
             "it's colder than a mother-in-law's welcome at Christmas."],
  cold:     ["it's nippy. Bracing. The sort of weather that makes a penguin reach for a cardigan.",
             "it's what my grandmother called 'a bit fresh', shortly before she lost two toes.",
             "it's chilly enough to make your nose run faster than the trains."],
  mild:     ["it's mild. Beige. The Rich Tea biscuit of temperatures.",
             "it's neither one thing nor the other. Like a lukewarm bath, or a middle manager.",
             "it's perfectly adequate, which is the highest praise this nation has ever given anything."],
  warm:     ["it's pleasantly warm — which in Britain means everyone will be pink by four o'clock.",
             "it's warm enough for the man next door to light a barbecue and set fire to a sausage, a fence and his eyebrows.",
             "it's lovely, so naturally everyone will complain that it's 'close'."],
  hot:      ["it's hot. Hotter than a vicar's bath on a Saturday night.",
             "the tarmac is melting, the trains have stopped, and someone in Surrey is writing to the papers about it.",
             "it's so hot even the pigeons have taken their coats off."],
};

/* ---------------- INTERRUPTIONS (absurd) ---------------- */
const INTERRUPTIONS = [
  [['N', "[A large wet fish falls from the sky and lands at {H}'s feet]", 'fish'],
   ['H', "...That was not in the forecast."],
   ['S', "Bagsy that for {me} tea!"]],
  [['N', "[A sheep wanders on, looks directly at the camera, and bleats knowingly]", 'sheep'],
   ['S', "That's my cousin!"],
   ['H', "Yes. I can see the resemblance. Particularly around the eyes."]],
  [['N', "[The scenery wobbles alarmingly]", 'shake'],
   ['H', "Budget cuts. We had to sell the nails."]],
  [['N', "[The lights go out. A single trumpet plays. The lights come back on.]", 'lightsout'],
   ['H', "...Nobody mention that. Ever."]],
  [['N', "[A man in a bowler hat walks across the back of the set, shouts 'WEASELS!', and leaves]"],
   ['S', "Who was that?"],
   ['H', "Head of Programming."]],
  [['N', "[A distant voice from offstage: 'Has anybody seen my trousers?']"],
   ['H', "Not now, Director."]],
];

/* ---------------- GUESTS ---------------- */
const GUESTS = {
  nimbus: {
    enter: ["[Enter PROFESSOR NIMBUS, backwards, through the wrong door]",
            "[Enter PROFESSOR NIMBUS, carrying a barometer and a startled pigeon]"],
    intro: ["Here to explain the science, it's {Gfull} of the University of Lower Bogworth. Professor?",
            "To make sense of all this, we're joined by {Gfull}, who has a doctorate in clouds and a criminal record in kites."],
    lines: {
      clear:   "The sky is clear today because all the clouds have gone to a conference in Belgium. They'll be back on Thursday — hungover, and grey.",
      night:   "The sky is clear tonight because the clouds have gone to bed. Clouds need fourteen hours' sleep. Like teenagers, or cats.",
      cloudy:  "Clouds are made of water vapour, dust, and approximately eleven per cent sheep. Escaped sheep. That's why they're fluffy. And why they're grumpy.",
      fog:     "Fog is simply a cloud that has fallen over and is too embarrassed to get back up. Please do not laugh at it. It's having a very difficult week.",
      drizzle: "Drizzle is caused by very small clouds trying to rain and not quite managing it. Like a toddler attempting a sneeze.",
      rain:    "Rain, you see, is clouds that have become too emotional. Today's rain, by my calculations, was caused by someone in {city} saying the word 'moist' at a christening.",
      snow:    "Snow is rain that the Ministry has kept in the freezer for later. Today, it is later.",
      thunder: "Thunder is two clouds having a row about money. Lightning is when one of them throws a saucepan.",
      wind:    "Wind is caused, as everyone knows, by trees waving. If the trees would only keep still, there would be no wind at all. I've written to them. Twice.",
    },
    retort: ["Is that peer-reviewed, Professor?|My peers were asleep at the time, but nobody objected.",
             "Professor, that is complete nonsense.|Yes! Isn't it marvellous? I've had a grant for it since 1987."],
  },
  edna: {
    enter: ["[Enter MRS PRATT, brandishing a handbag]",
            "[Enter MRS PRATT, already halfway through a sentence]"],
    intro: ["We go now to {Gfull}, a viewer, who has written in seventeen times this week. Mrs Pratt?",
            "And here's a member of the public — {Gfull}, of {city}. You have a complaint, Mrs Pratt?"],
    lines: {
      clear:   "This sunshine is a disgrace! Nobody asked for it! My net curtains have faded, the milk's gone off, and the man at number nine has taken his shirt off. I've seen his back. Nobody should have to see his back!",
      night:   "It's far too clear tonight! I can see right into the Hendersons' front room. They've bought a new settee. On a Tuesday! Who buys a settee on a Tuesday?",
      cloudy:  "Grey! Grey, grey, grey! I've had more colour out of a boiled egg. I want a word with whoever's in charge of the sky, and I want it in writing!",
      fog:     "I went to the shops in this fog and came home with somebody else's husband. Mind you, he's nicer than mine. I'm keeping him.",
      drizzle: "It's not even proper rain! If it's going to rain, it should rain like it means it! This is just the sky spitting at me, and I won't have it, {Hyoung}!",
      rain:    "I want to complain about the rain. It's been landing on my geraniums without so much as a by-your-leave. In my day, rain knocked first!",
      snow:    "Snow! At my age! I've had to put on my second-best coat and my sensible boots, and now I look like a pork pie in wellingtons!",
      thunder: "That thunder made me drop me teacup! That was a commemorative teacup, that! Some royal wedding or other! I want compensation!",
      wind:    "This wind has taken my hat, my bins, and my neighbour's cat. The cat's delighted. I am not!",
    },
    retort: ["Thank you, Mrs Pratt. Your complaint will be filed. Mostly in the fire.|I heard that! Sit up straight!",
             "I'll have a very strong word with the sky, Mrs Pratt.|You do that! And tell it to wipe its feet!"],
  },
  smethwick: {
    enter: ["[Enter MR SMETHWICK of the Ministry, very slowly, with a clipboard]",
            "[Enter MR SMETHWICK, who has been standing behind the curtain since Tuesday]"],
    intro: ["And now an official announcement from {Gfull}, Ministry of Weather, Department of Unforeseen Precipitation.",
            "We're joined by {Gfull} from the Ministry, who has a statement. He always has a statement."],
    lines: {
      clear:   "Owing to unexpected sunshine, the Ministry has issued a Grade Two Cheerfulness Advisory. Citizens may smile, but must not whistle, and under no circumstances should anyone say 'Phew, what a scorcher'.",
      night:   "The Ministry reminds citizens that the stars tonight are for looking at only. Wishing upon them requires a licence, available from the Post Office between ten and ten past ten.",
      cloudy:  "The Ministry is pleased to confirm that today's clouds have been licensed and inspected. Cloud number four thousand four hundred and twelve failed its fluffiness test and has been sent to Swindon.",
      fog:     "Visibility today is officially classified as 'Pardon?'. Citizens are advised to locate their front doors by smell.",
      drizzle: "The Ministry wishes to clarify that drizzle does not count as rain for official purposes. You are therefore not wet. Any sensation of wetness should be reported on Form D-12, in triplicate, in person. Outside.",
      rain:    "Under Section Four of the Damp Persons Act, citizens of {city} must walk through rain in an orderly fashion. Running between the drops will be treated as queue-jumping.",
      snow:    "Snow has been authorised for the duration of the day. Each citizen is entitled to one snowball. Additional snowballs must be applied for in advance, with two forms of identification and a carrot.",
      thunder: "The Ministry apologises for the thunder. It was meant for Belgium. The clerk responsible has been struck by lightning, as is traditional.",
      wind:    "Wind speeds of {wind} miles per hour have been approved by the Ministry. Hats are to be held on with the left hand. The right hand is reserved for clutching pearls.",
    },
    retort: ["Thank you, Mr Smethwick. Riveting, as always.|Thank you. This announcement has been an announcement.",
             "Is there anything else, Mr Smethwick?|There is always something else. But not today. Today it is classified."],
  },
  captain: {
    enter: ["[Enter CAPTAIN GALE-FORCE, at the double, saluting everything]",
            "[Enter CAPTAIN GALE-FORCE, through a hedge]"],
    intro: ["Let's go live to our outdoor correspondent, {Gfull}. Captain, what's it like out there?",
            "Reporting from the front line of the weather, it's {Gfull}. Captain?"],
    lines: {
      clear:   "Sun's up, sky's blue, enemy nowhere to be seen! I suspect they're hiding behind it, the cads. I've ordered the chaps to stare at it until it surrenders!",
      night:   "Clear night, sir! Perfect for a moonlit raid! I've raided the larder twice already. No casualties, apart from a pork pie.",
      cloudy:  "Grey cloud cover from horizon to horizon! Perfect conditions for sneaking about! I've sneaked about four times already. Nobody noticed. Nobody ever notices!",
      fog:     "Can't see a blessed thing! I've been saluting a lamppost for twenty minutes! Jolly decent lamppost, though. Officer material.",
      drizzle: "Light drizzle! Hardly worth mentioning! Like being attacked by a mosquito with a water pistol! It's all in my report. Page one. Page one just says 'damp'.",
      rain:    "Conditions appalling! Wet in every direction! I've lost two men to a puddle and the third turned out to be a garden gnome! Morale is magnificent!",
      snow:    "Snow! Splendid! Reminds me of school! Cold showers, cold dormitories, cold porridge! Happiest days of my life!",
      thunder: "Heavy artillery overhead! Lightning to the left of me, thunder to the right! I've never felt more alive! Mind you, I've also never felt more like a lightning conduct—",
      wind:    "Gale force winds, sir! Which is to say: me! Gale-Force! Ha! Family joke. Nobody has ever laughed at it.",
    },
    retort: ["Thank you, Captain. Do try not to die.|Can't promise anything! Tally-ho!",
             "Captain, are you actually outside?|Define 'outside', sir."],
  },
  arabella: {
    enter: ["[Enter LADY ARABELLA FOGG, dripping in pearls and contempt]",
            "[Enter LADY ARABELLA, fashionably late, via a chaise longue]"],
    intro: ["For the society angle, here's our glamour correspondent, {Gfull}. Arabella, darling, how is everyone coping?",
            "Joining us from somewhere rather nicer than here, {Gfull}. Lady Arabella?"],
    lines: {
      clear:   "Glorious sunshine, darlings. Everyone's at their country houses pretending to play croquet. Do bring a hat. And an alibi.",
      night:   "A clear night, darling. Perfect for a moonlit stroll, or for pushing one's husband into the ornamental lake. I did both. Tremendous fun.",
      cloudy:  "Overcast. Terribly middle-class weather. The sky has gone beige, darling. One simply shudders.",
      fog:     "Fog, darling — perfect for a discreet exit from a dreary dinner party. I've left four this evening. Two of them were my own.",
      drizzle: "Drizzle. The weather equivalent of a man who says he'll telephone. He won't, darling. Bring a brolly.",
      rain:    "Rain, darling. Simply everywhere. The Duchess went out in it and came back looking like a damp spaniel. Which, between us, was an improvement.",
      snow:    "Snow, darlings! Coats out, chins up, and simply everyone looks like an expensive pillow.",
      thunder: "Thunder, darling. The sky is having a tantrum. I know the feeling. I had one at the races. They still talk about it.",
      wind:    "Windy, darling. Hold onto your hats, your husbands and your dignity. In roughly that order of importance.",
    },
    retort: ["Thank you, Arabella.|Don't mention it, darling. Really. Don't.",
             "Thank you, Lady Arabella.|Ciao, darlings. Do try to be interesting."],
  },
  drench: {
    enter: ["[Enter LORD DRENCH, with the air of a man who has been made to come]",
            "[Enter LORD DRENCH, sighing deeply]"],
    intro: ["And now our resident weather sceptic, {Gfull}. Barnaby, any thoughts?",
            "Joining me is {Gfull}, who has agreed to appear in exchange for being left alone afterwards."],
    lines: {
      clear:   "Sunshine. Don't be fooled. The British sun is like a smile from a solicitor — brief, insincere, and followed by an invoice.",
      night:   "A clear night. Wonderful. Now the stars can watch me failing as well.",
      cloudy:  "Grey again. I've seen more excitement in a sock drawer. In fact, I've spent the morning in a sock drawer, purely for the thrill.",
      fog:     "Fog. Splendid. Nobody can see me. I've spent all morning avoiding creditors, relatives and my own reflection.",
      drizzle: "Drizzle. The sky can't even be bothered to rain properly. I sympathise. I can't be bothered to forecast it properly.",
      rain:    "It's raining. It's always raining. If God had meant {city} to be dry, he'd have put it somewhere nice. Like anywhere else.",
      snow:    "Snow. Pretty for ten minutes, then grey slush for a fortnight. Like most marriages.",
      thunder: "Thunder and lightning. Very dramatic. I'd prefer it if it could be dramatic somewhere else. The Isle of Wight, perhaps.",
      wind:    "Windy. Delightful. My hat has gone to Norfolk. I may follow it. Anything to get out of here.",
    },
    retort: ["Thank you, Barnaby.|Don't thank me. Just let me go home.",
             "Always a pleasure, Lord Drench.|You're lying, Arabella, but I admire the effort."],
  },
};

/* ---------------- THE NUMBERS ---------------- */
const DETAILS = [
  [['H', "{Sfirst}, the instruments, please."],
   ['S', "Right! The wind is {wind} miles an hour from the {windDir}, gusting {gust}. Humidity is {hum} per cent. And the chance of rain today is... {pop} per cent!"],
   ['H', "Good heavens. Correct numbers. Who did you copy them from?"],
   ['S', "The Professor."],
   ['H', "Of course."]],
  [['S', "I've done the measurements, {Hhon}! I stuck my finger up and the wind is {wind} miles an hour from the {windDir}!"],
   ['H', "And the humidity?"],
   ['S', "I licked a frog. {hum} per cent."],
   ['H', "I genuinely cannot tell whether that's science or a cry for help. Chance of rain?"],
   ['S', "{pop} per cent!"]],
  [['H', "The numbers. Wind: {wind} miles an hour from the {windDir}, gusts to {gust}. Humidity {hum} per cent. Chance of rain: {pop} per cent."],
   ['S', "What does all that mean, {Hhon}?"],
   ['H', "It means, {Sfirst}, that the weather will continue to happen. Right up until it stops."]],
  [['S', "I've got the official readings, {Hhon}! Wrote 'em on {me} hand. Wind {wind}, gusts {gust}, humidity {hum}, chance of rain {pop}..."],
   ['S', "...and 'buy eggs'."],
   ['H', "Thank you, {Sfirst}. We'll send someone round about the eggs."]],
];

/* ---------------- TOMORROW & THE WEEK ---------------- */
const TOMORROW = [
  "Tomorrow: {tCond}, with a high of {tHi} and a low of {tLo}. Make of that what you will. I certainly shan't.",
  "Looking ahead to tomorrow: {tCond}, topping out at {tHi}, dropping to {tLo} overnight, with a {tPop} per cent chance of rain.",
  "Tomorrow brings {tCond}. Highs of {tHi}, lows of {tLo}. Which is frankly more than you deserve.",
  "Tomorrow, {city} can expect {tCond}, a high of {tHi}, a low of {tLo}, and the usual sense of quiet despair.",
];
const WEEK = [
  "As for the week ahead: the best day will be {bestDay}. The worst will be {worstDay}, which I have personally cancelled.",
  "The pick of the week is {bestDay}. Avoid {worstDay}, unless you enjoy being damp and disappointed — in which case, welcome to Britain.",
  "Later this week, {bestDay} looks the most bearable. {worstDay} looks like it's been designed by a committee of ducks.",
];

/* ---------------- ACTUALLY USEFUL ADVICE ---------------- */
const ADVICE = {
  umbrella: ["Take an umbrella. If you haven't got one, take {Sfirst}. He's roughly the same shape and twice as absorbent.",
             "Umbrella, please. Rain chance today is {pop} per cent, and your hair is not as waterproof as your opinions."],
  coat:     ["Wear a coat. A proper one. Not the thin fashionable thing — the one your mother would approve of.",
             "Top out at {hi} today. Coat on. Scarf on. Dignity optional."],
  ice:      ["It drops to {lo} tonight, so watch out for ice. It's slippery, treacherous and invisible — rather like my cousin Gerald."],
  sun:      ["UV index today is {uv}. Wear sun cream, unless you want to look like a boiled lobster in a Hawaiian shirt.",
             "UV of {uv}, so slap on the sun cream. A hat wouldn't hurt either. Well, it might, if {Sfirst} throws it."],
  wind:     ["Gusts up to {gust} miles an hour. Hold onto your hat. And your umbrella. And, if you are small, a lamppost."],
  fog:      ["Drive carefully in the fog. Dipped headlights, and assume everybody else on the road is {Sfirst}."],
  heat:     ["It's hot, so drink water, find shade, and check on elderly neighbours. Even the nosey ones. Especially the nosey ones."],
  nice:     ["No special precautions needed. Go outside. Enjoy it. Whatever 'it' is. I shall be indoors.",
             "Nothing to worry about today. Which is, in itself, deeply worrying."],
};

/* ---------------- CLOSINGS ---------------- */
const CLOSINGS = [
  [['H', "That's the weather. It'll be wrong by morning, but then so is most of what you hear. Goodnight, {city}."],
   ['S', "Goodnight!"],
   ['H', "Not you, {Sfirst}. You're staying to mop up."]],
  [['H', "That's all from us. Sunset tonight is at {sunset}. Do watch it. It's the only thing on today that knows when to leave."]],
  [['S', "Can I do the ending this time, {Hhon}?"],
   ['H', "Oh, very well."],
   ['S', "...The end!", 'hop:S'],
   ['H', "Truly, the Bard is reborn. Goodnight, {city}."]],
  [['H', "And that was the weather. Join us tomorrow, when it will be different — and so, regrettably, will we."]],
  [['H', "Sunrise tomorrow is at {sunrise}, should you wish to witness it. I shan't. Goodnight."],
   ['S', "I'll wake you, {Hhon}!"],
   ['H', "If you do, {Sfirst}, it will be the last thing you ever wake."]],
];

/* ---------------- PANEL QUIPS (plain-English subtitle under the temperature) ---------------- */
const PANEL_QUIPS = {
  clear: ['Sunglasses on. Expectations cautiously raised.', 'The sky is blue. Suspiciously so.'],
  night: ['Clear and dark. Good for stars, bad for burglars.', 'The moon is in. The sun has clocked off.'],
  cloudy: ['Grey. Reliably, comfortingly grey.', 'A ceiling of porridge.'],
  fog: ['You may not see this forecast.', 'Pea soup, without the peas.'],
  drizzle: ['Rain without commitment.', 'The sky is gently spitting.'],
  rain: ['Brolly weather.', 'Wet. Very wet. Splendidly wet.'],
  snow: ['Trains: cancelled. Children: ecstatic.', 'The wrong kind, probably.'],
  thunder: ['Unplug the telly. Hide the cat.', 'The sky is shouting.'],
};

const CREDITS_JOKES = [
  'No meteorologists were harmed in the making of this film. Several were mildly inconvenienced.',
  'Any resemblance to accurate forecasting is purely coincidental.',
  'The sheep appeared courtesy of a farmer who has not yet noticed.',
  "Filmed in front of a live studio audience of one, who was asleep.",
  'Mrs Pratt’s handbag was not insured.',
];
