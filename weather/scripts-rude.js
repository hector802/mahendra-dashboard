/* ==========================================================================
   THE WRITERS' ROOM, AFTER THE WATERSHED
   Ruder, sharper versions of the pools in scripts.js. Same structure and
   tokens. Used when the tone is "cheeky" (the default); "clean" falls back to
   scripts.js. Rude, never cruel: insults are aimed at characters, not groups.
   ========================================================================== */

const RUDE = {};

RUDE.OPENINGS = [
  [['H', "{greeting}, {city}. I'm {H}. I've been asked to present the weather in the same way a cat is asked to have a bath: under protest, and with a great deal of scratching."]],
  [['H', "{greeting}, and welcome to the weather. Today's forecast is brought to you by the phrase 'pissing it down'. I'm told I can't say that. Too late."]],
  [['H', "{greeting}, {city}. Here is the weather. Try to look interested. I certainly shan't bother."]],
  [['H', "{greeting}, you damp, miserable lot. The forecast, such as it is."]],
  [['H', "{greeting}. I'm {H}. If you're watching this for the weather, you're braver than I am. Or you've sat on the remote."]],
];

RUDE.SIDEKICK_INTROS = [
  [['H', "With me is {S}, a man so stupid he once got stuck in a revolving door and claimed squatter's rights."],
   ['S', "It was a very nice door!"]],
  [['H', "Joining me, unfortunately, is {S}. If brains were rain, he'd be a hosepipe ban."],
   ['S', "{Sexclaim}! Thank you, {Hhon}!"],
   ['H', "Still not a compliment, {Sfirst}."]],
  [['H', "This is {S}. His mother dropped him on his head as a baby. Repeatedly. From a height. With a run-up."],
   ['S', "She said it was for luck!"],
   ['H', "It didn't work."]],
  [['S', "{Sexclaim}! Am I on the telly?"],
   ['H', "You are, {Sfirst}, and the nation is collectively wondering why. Say hello."],
   ['S', "Hello, everybody!"],
   ['H', "Several of them have just changed channel."]],
  [['H', "{S} is here. He has the brain of a whelk and the personal hygiene of a slightly more ambitious whelk."],
   ['S', "I had a bath on Sunday!"],
   ['H', "Which Sunday, {Sfirst}? Be specific."]],
];

RUDE.CONDITIONS = {
  clear: [
    [['H', "It's {temp} and sunny, which means half of {city} is already in the park, lobster-pink, bellies out, like a row of boiled hams."],
     ['S', "Should I take my shirt off too, {Hhon}?"],
     ['H', "Only if you actively hate children."]],
    [['H', "Glorious sunshine, {temp}. Not a cloud in the sky. Naturally, this has made everyone utterly insufferable."],
     ['S', "I feel ever so cheerful!"],
     ['H', "Well, stop it. It's unsettling. You look like a haunted potato."]],
  ],
  night: [
    [['H', "A clear night, {temp}. The stars are out, and so are the foxes, screaming like divorcees at a car boot sale."],
     ['S', "Is that what that noise is?"],
     ['H', "Either that, {Sfirst}, or your mother's found the sherry again."]],
  ],
  cloudy: [
    [['H', "It's {temp} and grey. The sky is the colour of a pensioner's underpants, and roughly as cheerful."],
     ['S', "How do you know what colour a pensioner's underpants are?"],
     ['H', "I've been to Bournemouth, {Sfirst}. In August. I've seen things."]],
    [['H', "Overcast, {temp}. The sky has all the joie de vivre of a damp tea towel at a funeral."],
     ['S', "Ooh, I love a funeral. There's sandwiches."],
     ['H', "There'll be sandwiches at yours, {Sfirst}. Soon, if you keep talking."]],
  ],
  fog: [
    [['H', "Thick fog, {temp}. You can't see your hand in front of your face, which, in your case, {Sfirst}, is a mercy for everyone."],
     ['S', "What's that supposed to mean?"],
     ['H', "It means you've got a face like a dropped pie."]],
    [['H', "Fog, {temp}. Visibility is so poor that, for once, nobody can see {Sfirst}'s haircut."],
     ['S', "{Mum} did it!"],
     ['H', "With what? A lawnmower and a grudge?"]],
  ],
  drizzle: [
    [['H', "Drizzle, {temp}. That sneaky rain that's too cowardly to rain properly but too spiteful to stop. The weather equivalent of {Sfirst}."],
     ['S', "Thank you!"],
     ['H', "It wasn't a compliment. I once called you a festering boil and you sent me a thank-you card."]],
    [['H', "It's drizzling, {temp}. Not enough to get properly wet. Just enough to make you smell like a damp Labrador."],
     ['S', "I always smell like a damp Labrador."],
     ['H', "Yes, {Sfirst}. We'd assumed it was medical."]],
  ],
  rain: [
    [['H', "It's absolutely pissing it down in {city}. {temp}. The rain is coming down sideways, upwards, and in at least one case, personally."],
     ['S', "{Sexclaim}! I'm soaked to the bone!"],
     ['H', "Good. It's the first wash you've had since the Jubilee."]],
    [['H', "It's {temp} and raining so hard the ducks have filed a complaint."],
     ['S', "Shall I go and get an umbrella, {Hhon}?"],
     ['H', "Yes, {Sfirst}. Go and get one. Go a very long way. Take your time. Possibly emigrate."]],
    [['H', "Heavy rain, {temp}. Biblical. If you see a bloke building a large boat, ask if he's got room for you."],
     ['S', "Has he got room for me?"],
     ['H', "Not you, {Sfirst}. He's taking two of every animal, not one of every idiot."]],
  ],
  snow: [
    [['H', "It's snowing! {temp}. Cold enough to freeze the knackers off a brass monkey."],
     ['S', "I haven't got a brass monkey."],
     ['H', "No, {Sfirst}. You've got a brass neck and a head full of porridge."]],
    [['H', "Snow in {city}, {temp}. Within the hour, every bloke on the street will have built a snowman with an anatomically ambitious carrot."],
     ['S', "I did that!"],
     ['H', "Of course you did. The police have been round."]],
  ],
  thunder: [
    [['H', "Thunderstorms, {temp}. If you hear a loud bang—"],
     ['N', "[CRASH]", 'flash'],
     ['S', "AAAAARGH! I think I've had a little accident!", 'hop:S'],
     ['H', "You have, {Sfirst}. We can all smell it."]],
    [['H', "Lightning about, {temp}. Avoid open fields, tall trees, and {Sfirst}, who's wearing so much hair gel he's basically a lightning rod with a fringe."],
     ['S', "It's a very expensive gel!"],
     ['H', "It's lard, {Sfirst}. You've been using lard."]],
  ],
};

RUDE.TEMP_QUIPS = {
  freezing: ["it's colder than a witch's bra in a butcher's freezer.",
             "it's so cold I saw a politician with his hands in his own pockets.",
             "it's cold enough to make a polar bear put on thermals and phone its mum."],
  cold:     ["it's bloody freezing. The brass monkeys are queuing at A and E.",
             "it's the kind of cold where you can't feel your feet. Which, judging by your feet, is a blessing.",
             "it's nippy enough to cut glass with your nipples. Please don't try."],
  mild:     ["it's mild. Painfully, tediously mild. Like a vicar's stag do.",
             "it's beige. The weather equivalent of a man in socks and sandals explaining his loft insulation.",
             "it's neither hot nor cold. It's lukewarm, like a pub's toilet seat."],
  warm:     ["it's warm enough for every man in Britain to take his top off, and not one of them should.",
             "it's warm. Sweaty-crack warm. Sorry. Somebody had to say it.",
             "it's warm enough for the barbecues to come out, and for Dave to give everyone food poisoning again."],
  hot:      ["it's hotter than a vindaloo in a sauna.",
             "it's so hot I've seen pigeons fanning themselves with chips.",
             "it's sweltering. Thighs are sticking to car seats from here to Doncaster."],
};

/* Same order as INTERRUPTIONS in scripts.js so ?gag=fish etc. still work. */
RUDE.INTERRUPTIONS = [
  [['N', "[A large wet fish falls from the sky and lands at {H}'s feet with a disgusting slap]", 'fish'],
   ['H', "...Who threw that?"],
   ['S', "It's raining cod, {Hhon}!"],
   ['H', "It's a haddock, you pillock."]],
  [['N', "[A sheep wanders on, looks at the camera, and bleats with obvious contempt]", 'sheep'],
   ['H', "Even the sheep thinks this forecast is rubbish."],
   ['S', "She's got a point."],
   ['H', "She's got more brains than you, {Sfirst}. And better hair."]],
  [['N', "[The scenery wobbles and part of the set falls over]", 'shake'],
   ['H', "Budget cuts. The whole set is held together with Blu-Tack and spite."],
   ['S', "And chewing gum!"],
   ['H', "Is that where your gum went? You absolute animal."]],
  [['N', "[The lights go out. Somebody screams. The lights come back on.]", 'lightsout'],
   ['H', "Who screamed?"],
   ['S', "...Me."],
   ['H', "Of course it was."]],
  [['N', "[A man in a bowler hat sprints across the set yelling 'WEASELS! IN MY TROUSERS!' and is gone]"],
   ['H', "Head of Programming. He's having a difficult week."]],
  [['N', "[A voice from offstage: 'Has anybody seen my trousers?']"],
   ['H', "They're in the canteen, Director. Next to your dignity."]],
];

RUDE.GUESTS = {
  nimbus: {
    lines: {
      clear:   "The sun is simply a large ball of gas. Rather like the Minister for Transport. Or me, after a curry.",
      night:   "Stars are tiny holes in the sky where God has flicked his fag ash. I've measured them. With a ruler. While drunk.",
      cloudy:  "Clouds are made of water vapour and approximately eleven per cent sheep farts. That's why they're grey, and why Swindon smells like that.",
      fog:     "Fog is the Earth breathing out after a heavy night. It's essentially the planet's hangover, and frankly, it can't hold its drink.",
      drizzle: "Drizzle is caused by small, weak clouds with no follow-through. Like a teenage boy's first attempt at a moustache.",
      rain:    "Rain is simply clouds wetting themselves with excitement. Today's downpour was caused by a cloud seeing a man in Ipswich get out of his bath.",
      snow:    "Snow is dandruff from heaven. God is under enormous stress. Have you seen the news?",
      thunder: "Thunder is the sky breaking wind. Lightning is when it does it near a candle.",
      wind:    "Wind, as the name suggests, is the planet having a good old trump after a big bowl of beans. Gusting {gust} miles an hour today, so it was a very big bowl.",
    },
    retort: ["Professor, is any of that true?|Not a word! But I'm paid by the syllable!",
             "Professor, you are an idiot.|A tenured idiot! You can't sack me! I've checked!"],
  },
  edna: {
    lines: {
      clear:   "This sun's a disgrace! My Derek's been out in it since nine with his belly out, basting himself like a Sunday joint! I've had to throw a sheet over him so the neighbours don't think we've bought a walrus!",
      night:   "It's far too clear! I can see right into number twelve's bedroom! He's doing his exercises in the nude again! At his age! It's like watching two ferrets fight in a bin bag!",
      cloudy:  "Grey, grey, grey! It's like living inside my husband's vest! And that hasn't been washed since decimalisation either!",
      fog:     "I went out in this fog and kissed the milkman thinking he was my Derek! Mind you, I've been doing that for years. The fog's just a good excuse!",
      drizzle: "This drizzle's made my perm go like a startled poodle! I look like I've been dragged through a hedge backwards by a randy badger!",
      rain:    "I want to complain about the rain! It's soaked my smalls on the line, and now Mrs Henderson's seen my big knickers! The ones with the elastic gone! I'll never live it down!",
      snow:    "Snow! At my age! I went flat on my arse outside the Co-op and a teenager filmed it! Now I've gone 'viral'! It sounds medical!",
      thunder: "That thunder gave me such a fright I've had to change my underwear! Twice! And they were my good ones!",
      wind:    "This wind's blown my skirt over my head in front of the whole bus queue! Fourteen people have seen my bloomers! The number 37 will never be the same!",
    },
    retort: ["Thank you, Mrs Pratt. That was very... vivid.|Don't you get clever with me, you jumped-up cloud botherer!",
             "Mrs Pratt, please, calm down.|Calm down? I'll calm you down with my handbag, you cheeky sod!"],
  },
  smethwick: {
    lines: {
      clear:   "Owing to sunshine, the Ministry reminds men over forty that they may not remove their shirts in public without a permit, a doctor's note, and a stomach you couldn't stand a pint on.",
      night:   "Citizens are reminded that howling at the moon after closing time is restricted to licensed premises and Wigan.",
      cloudy:  "The Ministry confirms today's clouds are grey, government-issue, and were purchased from a man called Terry in a car park. We do not know where Terry is now. Neither does Terry.",
      fog:     "Due to fog, visibility is officially classified as 'bugger all'. That is the technical term. I fought very hard for it.",
      drizzle: "The Ministry wishes to clarify that drizzle is not rain. It is the sky spitting at you, personally, because of something you did. You know what you did.",
      rain:    "Under the Damp Persons Act, anyone caught running between raindrops will be fined and made to stand in a puddle until they've had a good long think about themselves.",
      snow:    "Snowmen must be built to Ministry specifications. Carrots are for noses only. I have seen what you people do with carrots. I will not see it again.",
      thunder: "The Ministry apologises for the thunder. It was meant for France. Again.",
      wind:    "Gusts of {gust} miles an hour have been approved. Gentlemen with comb-overs are advised to stay indoors, or accept that the game is finally up.",
    },
    retort: ["Thank you, Mr Smethwick.|This announcement will now self-destruct. Metaphorically. Probably.",
             "Is that everything, Mr Smethwick?|No. But the rest is classified. And rude."],
  },
  captain: {
    lines: {
      clear:   "Sun's out, chaps! The men are stripped to the waist and glistening! It's like a Roman bath house out here! Not that I'd know! I've never been! Shut up!",
      night:   "Clear night, sir! Perfect for a covert operation! I've already crawled through a hedge and into the vicarage! Turns out the vicar's wife is a terrific shot!",
      cloudy:  "Grey skies, sir! Ideal for sneaking about! I've ambushed the enemy four times already! Turns out it was a hedge. I've been taken prisoner by a hedge, sir!",
      fog:     "Can't see a damned thing, sir! I've just spent twenty minutes passionately saluting a lamppost! I think we might be engaged!",
      drizzle: "Light drizzle, sir! Barely damp! Like being sneezed on by a particularly polite badger!",
      rain:    "It's absolutely hammering down, sir! I'm wet in places I didn't know I had! My socks are soggy, my moustache has gone limp, and frankly, it's not the only thing!",
      snow:    "Snow, sir! Marvellous! A bit nippy around the old crown jewels, but a British officer never complains! ...I think they've gone, sir. I think they've actually gone.",
      thunder: "Lightning, sir! It's struck the flagpole, the tea urn and Corporal Jenkins! He's fine! He's glowing a bit, but he's fine!",
      wind:    "Gale force winds, sir! My kilt's gone right up! Half the regiment's seen my sporran, and the other half's seen the rest!",
    },
    retort: ["Thank you, Captain. Try not to die.|Die? Ha! I've been shot four times, sir! Mostly by myself!",
             "Captain, are you drunk?|Only medicinally, sir! Tally-ho!"],
  },
  arabella: {
    lines: {
      clear:   "Sunshine, darling. Simply everyone is at the lido, displaying bodies that ought to be kept under a tarpaulin. I saw the Bishop in Speedos. I may need therapy.",
      night:   "A clear night, darling. Perfect for a moonlit tryst. Not with you, obviously. I'm not desperate. Well. Not that desperate.",
      cloudy:  "Grey, darling. Utterly beige. Like a dinner party in Surrey where everyone's discussing their kitchen extension.",
      fog:     "Fog is marvellous, darling. One can slip away from a dreary party unnoticed. I've left three husbands that way.",
      drizzle: "Drizzle, darling. Like a man who promises everything and delivers a damp disappointment. I've married two of them.",
      rain:    "Rain, darling. The Duchess went out in it and came back looking like a drowned ferret in a fur coat. Which, to be fair, is how she looks dry.",
      snow:    "Snow, darling! The men all wrap up and look like expensive duvets. Which is frankly the most use most of them have ever been.",
      thunder: "Thunder, darling. The sky's having a tantrum. I know the feeling. I once threw a canapé at a viscount. He had it coming.",
      wind:    "Windy, darling. My hair is a tragedy, my hat is somewhere over Kent, and the vicar has now seen more of me than my husband has in ten years.",
    },
    retort: ["Thank you, Arabella.|Don't mention it, darling. Ever. To anyone. Particularly the press.",
             "Lovely as always, Arabella.|I know, darling. One of us has to be."],
  },
  drench: {
    lines: {
      clear:   "Sunshine. Wonderful. Now the whole country can see what it looks like in shorts. I've seen more attractive things growing at the back of a student's fridge.",
      night:   "A clear night. Millions of stars, each one further away from this programme than I am. Lucky sods.",
      cloudy:  "Grey again. I've had more excitement from a cheese and onion crisp. In fact, I married one.",
      fog:     "Fog. Marvellous. I've spent the morning hiding from creditors, relatives and Mrs Pratt, who I believe intends to sit on me.",
      drizzle: "Drizzle. The sky can't even be bothered to rain properly. Like a dog that won't fetch: pointless, damp, and smelling faintly of failure.",
      rain:    "It's raining. It's always raining. If God had meant {city} to be dry, he'd have put it somewhere decent. Like France. And I hate France.",
      snow:    "Snow. Pretty for ten minutes, then grey slush that looks like something a poorly dog left behind.",
      thunder: "Thunder. Very dramatic. Rather like my ex-wife. Except thunder eventually stops.",
      wind:    "Windy. My hat has gone to Norfolk. I'm going after it. With any luck, neither of us will come back.",
    },
    retort: ["Thank you, Barnaby.|Don't thank me. Just pay me.",
             "Always a pleasure, Lord Drench.|You're a dreadful liar, Arabella. It's why I like you."],
  },
};

RUDE.DETAILS = [
  [['H', "{Sfirst}, the instruments."],
   ['S', "Right! Wind's {wind} miles an hour from the {windDir}. Humidity's {hum} per cent. Chance of rain: {pop} per cent!"],
   ['H', "Accurate numbers. I'm stunned. Who did you bribe?"],
   ['S', "Nobody! I read them off the computer!"],
   ['H', "You can read? Since when?"],
   ['S', "Tuesday."]],
  [['S', "I measured the wind {myself}, {Hhon}! I licked my finger and stuck it up—"],
   ['H', "Up where, {Sfirst}?"],
   ['S', "...Up in the air!"],
   ['H', "Thank God for that."],
   ['S', "{wind} miles an hour, from the {windDir}!"]],
  [['S', "Humidity's {hum} per cent, {Hhon}!"],
   ['H', "And how did you measure that?"],
   ['S', "I checked how damp {me} pants were."],
   ['H', "...And the chance of rain?"],
   ['S', "{pop} per cent. Same method."]],
  [['H', "Wind {wind} miles an hour, gusts to {gust}. Humidity {hum} per cent. Rain chance {pop} per cent."],
   ['S', "What does all that mean, {Hhon}?"],
   ['H', "It means put a coat on and stop asking stupid questions. Or do one of the two. I'm not fussy."]],
];

RUDE.ADVICE = {
  umbrella: ["Take an umbrella. If you haven't got one, take {Sfirst}. Same shape, twice as absorbent, and nobody will mind if he blows inside out.",
             "Brolly, please. {pop} per cent chance of rain, and you look rubbish wet. Trust me. I can see you."],
  coat:     ["Wear a coat. A proper one. Not that daft little jacket that shows your bum. Nobody wants to see your bum. Except possibly Mrs Pratt."],
  ice:      ["It drops to {lo} tonight, so watch out for ice. Treacherous, slippery and two-faced. Rather like my brother-in-law."],
  sun:      ["UV is {uv} today. Wear sun cream, unless you want to look like a slapped arse by teatime."],
  wind:     ["Gusts up to {gust} miles an hour. Hold onto your hat, your brolly and your toupee. Yes, Gerald. We all know."],
  fog:      ["Drive carefully in the fog. Dipped headlights, and assume every other driver is {Sfirst}: lost, confused, and quite possibly asleep."],
  heat:     ["It's hot, so drink plenty of water. Not lager. Water. Yes, I know, Gary. It's a shock to us all."],
  nice:     ["Nothing to worry about today. So naturally, you'll find something. You're British. It's in the contract."],
};

RUDE.CLOSINGS = [
  [['H', "That's the weather. It'll be wrong by morning, but then so is most of what you hear on the telly. Goodnight, {city}."],
   ['S', "Goodnight!"],
   ['H', "Not you, {Sfirst}. You're staying behind to clean the toilets. Again."]],
  [['S', "Can I do the ending this time, {Hhon}?"],
   ['H', "Fine."],
   ['S', "...Er... Bum!", 'hop:S'],
   ['H', "Shakespeare would weep. Goodnight, {city}."]],
  [['H', "That's all from us. Sunset tonight is at {sunset}. Do watch it. It's the only thing on telly that knows when to bugger off."]],
  [['H', "And that was the weather. Join us tomorrow, when we'll be doing all this again, presumably as some form of punishment."]],
];

RUDE.PANEL_QUIPS = {
  clear: ['Sunny. Brace yourself for shirtless men.', 'The big yellow thing is back. Hide your pasty bits.'],
  night: ['Clear and dark. Foxes screaming. Business as usual.', 'The sun has buggered off for the night.'],
  cloudy: ['Grey. Like a pensioner’s vest.', 'Overcast and underwhelming.'],
  fog: ['Visibility: bugger all.', 'Pea soup. Hold onto someone. Not that one.'],
  drizzle: ['The sky is spitting at you. Personally.', 'Damp, sneaky and smug.'],
  rain: ['Absolutely pissing it down.', 'Brolly or bust.'],
  snow: ['Cold enough to freeze the knackers off a brass monkey.', 'Trains cancelled. Obviously.'],
  thunder: ['The sky is breaking wind loudly.', 'Unplug the telly. Clench.'],
};
