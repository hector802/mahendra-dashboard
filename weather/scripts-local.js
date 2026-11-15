/* ==========================================================================
   LOCAL REPERTOIRE + DAILY FORECAST SEGMENT
   - LOCAL: openers and bits for specific places, matched by place name.
   - TODAY: the "actual numbers" line used in the daily morning Reels.
   - Extra cheeky lines for the most common British weather, so a daily
     schedule doesn't repeat itself within a week.
   Tokens as scripts.js, plus {todayCond} {weekday} {date}.
   ========================================================================== */

const LOCAL = {
  london: {
    match: /^(city of )?london$/i,
    tags: '#london #londonweather #londonlife',
    openers: [
      "{greeting}, London. Nine million people, and not one of them has made eye contact since 1987. Here's your weather.",
      "{greeting}, London: the only city where a pint costs more than the bus, and the bus never comes.",
      "{greeting}, London. Grab your Oyster card, your umbrella and your usual sense of quiet resentment.",
      "{greeting}, London. It's {weekday}, it's {temp}, and somebody on the Central line is already eating an egg sandwich.",
    ],
    bits: [
      [['S', "Is the Tube running today, {Hhon}?"],
       ['H', "Partially, {Sfirst}. Which, in Transport for London terms, means there are technically trains. Somewhere. Possibly in Kent."]],
      [['S', "I saw a fox on the Tube this morning!"],
       ['H', "That wasn't a fox, {Sfirst}. That was a banker from Canary Wharf. They go like that before their first coffee."]],
      [['H', "The pigeons in Trafalgar Square report {todayCond} and a severe shortage of tourists' sandwiches."],
       ['S', "Poor pigeons!"],
       ['H', "Don't feel sorry for them, {Sfirst}. They own more property in Zone One than you ever will."]],
      [['H', "On the Thames it's {temp}. The river is brown, cold and full of things nobody wants to identify. Much like the Northern line at half past eight."]],
      [['H', "Rents in London went up again overnight. The weather, however, is still free."],
       ['S', "Hooray!"],
       ['H', "Don't get excited. Someone in Mayfair is already trying to charge for it."]],
      [['S', "Why's everyone in London walking so fast, {Hhon}?"],
       ['H', "To get away from people like you, {Sfirst}. It's the only exercise most of them get."]],
    ],
  },
  stow: {
    match: /stow/i,
    tags: '#stowonthewold #cotswolds #cotswoldlife #gloucestershire',
    openers: [
      "{greeting}, Stow-on-the-Wold, where the wind blows cold. That's not my joke. That's the actual saying. They've been moaning about it since the Middle Ages.",
      "{greeting}, Stow: the highest town in the Cotswolds, and therefore the first to know when it's about to be rubbish.",
      "{greeting}, Stow-on-the-Wold. Population: some sheep, a great many antique shops, and a Range Rover for every one of them.",
      "{greeting}, Stow. It's {weekday}, it's {temp}, and somewhere in the market square a man in red trousers is already complaining about parking.",
    ],
    bits: [
      [['S', "What's it like up in Stow today, {Hhon}?"],
       ['H', "{temp} and breezy. Stow is nearly eight hundred feet up, so the wind arrives fresh from Wales, has a look round the antique shops, and leaves in disgust."]],
      [['S', "I went in an antique shop in Stow, {Hhon}!"],
       ['H', "And?"],
       ['S', "They tried to sell me a chair for nine hundred pounds!"],
       ['H', "Did you buy it?"],
       ['S', "No! I was sitting on it. They sold it to the bloke behind me."]],
      [['H', "In the market square it's {temp}. Residents are reminded that the weather, unlike everything else in the Cotswolds, is not yet available as a scented candle."],
       ['S', "Are you sure?"],
       ['H', "Give it a week, {Sfirst}."]],
      [['H', "Cotswold sheep report {todayCond}. As ever, they are unmoved. They've seen worse. They've seen the tour coaches in August."]],
      [['H', "Weekenders up from London: bring a proper coat. Not the forty-quid gilet. The wind up here goes through a gilet like gossip through a Women's Institute."]],
      [['S', "Why's that church door got trees growing round it, {Hhon}?"],
       ['H', "It's St Edward's, {Sfirst}. People say it inspired Tolkien. Mostly the people selling the postcards."]],
    ],
  },
};

function localFor(name) {
  return Object.values(LOCAL).find(l => l.match.test(String(name || '').trim())) || null;
}

const TODAY = {
  clean: [
    "Here are the actual numbers, for those of you with jobs. Today: {todayCond}, top temperature {hi}, dropping to {lo} tonight, with a {pop} per cent chance of rain.",
    "Today's forecast: {todayCond}. A high of {hi}, a low of {lo}, and a {pop} per cent chance of rain. Wind from the {windDir} at {wind} miles an hour.",
    "The serious bit. Today brings {todayCond}, highs of {hi}, lows of {lo}, rain chance {pop} per cent. There. Now you can't say I never told you anything.",
  ],
  rude: [
    "Right, the useful bit, for those of you with actual jobs. Today: {todayCond}, high of {hi}, low of {lo}, and a {pop} per cent chance of rain. There. Done. Now for the bit you came for.",
    "Today's forecast: {todayCond}. Highs of {hi}, lows of {lo}, {pop} per cent chance of rain, and wind from the {windDir} at {wind} miles an hour. Write it on your hand if you have to.",
    "The numbers, since you insist. {todayCond}, topping out at {hi}, down to {lo} tonight, rain chance {pop} per cent. Don't say I never give you anything.",
  ],
};

/* More cheeky material for the commonest British weather. */
if (typeof RUDE !== 'undefined') {
  RUDE.CONDITIONS.cloudy.push(
    [['H', "Grey skies, {temp}. The sun has phoned in sick. Again. Fourth time this month, and HR are asking questions."],
     ['S', "Maybe it's actually poorly."],
     ['H', "It's a giant ball of nuclear fire, {Sfirst}. It doesn't get the sniffles."]],
    [['H', "Cloudy, {temp}. The sort of day that makes you want to pull the duvet over your head and pretend you've died. So: a normal {weekday}."],
     ['S', "I did that this morning!"],
     ['H', "We know, {Sfirst}. Your mum rang the vicar."]],
  );
  RUDE.CONDITIONS.rain.push(
    [['H', "Rain, {temp}. Steady, relentless, and soaking everything, like a wet Labrador shaking itself over the entire country."],
     ['S', "I love Labradors!"],
     ['H', "I know, {Sfirst}. Several of them have taken out restraining orders."]],
    [['S', "Is it ever going to stop raining, {Hhon}?"],
     ['H', "Yes, {Sfirst}. In about April."],
     ['S', "Which April?"],
     ['H', "Nobody knows. That's what makes it exciting."]],
  );
  RUDE.CONDITIONS.drizzle.push(
    [['H', "Drizzle, {temp}. Spit, basically. The sky is gobbing on us, and frankly, looking at you lot, who can blame it?"],
     ['S', "It's gobbed on me!"],
     ['H', "Good aim, sky."]],
  );
  RUDE.CONDITIONS.clear.push(
    [['H', "Sunshine, {temp}! Blue sky! So naturally the entire country will be in a pub garden by eleven, pretending it's on holiday."],
     ['S', "Can we go to the pub, {Hhon}?"],
     ['H', "You're barred from the pub, {Sfirst}. All of them. There was a meeting."]],
  );
  RUDE.TEMP_QUIPS.cold.push("it's what the British call 'a bit parky', which means everyone will be wearing shorts anyway, out of spite.");
  RUDE.TEMP_QUIPS.mild.push("it's 'not too bad, considering', which is the closest this nation ever gets to actual joy.");
}
