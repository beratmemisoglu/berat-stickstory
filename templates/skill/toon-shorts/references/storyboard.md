# From script to shots (storyboard)

How to turn the timed narration into shots: what each clause shows, how the camera and the transitions connect the
pictures, when to use inserts, and how to make an abstract idea into something the hero can touch. Exact calls are in
engine_api.md; motion presets in motion.md; the look in style.md.

Topics and numbers in the examples below are illustrations of a device, not checked facts: check the real facts for a
real video. All examples are original; build your own versions, never copies of someone else's video.

## 1. Sentences are shots, clauses are beats

- **A new sentence starts a new shot.** The scene changes on its first word: the transition starts 0-3 frames before
  that word.
- **A clause inside a sentence is a new beat inside the running shot**: a camera move starts, a face swaps, a prop
  pops, a light changes, a character acts. A beat every ~1.1-1.2 s (about 4 words); never more than 1.5 s without a
  visible change.
- A shot usually carries 2-4 beats (2.5-5 s). A travelling shot (a journey down a corridor, a dive into a machine) can
  carry up to ~8 beats (~10 s) as long as the camera keeps moving and something new arrives every ~1 s.
- Count for a 40 s short: ~10-13 shots, ~35 beats.

## 2. The storyboard table (write it before building)

One row per clause:

| # | time | words (say) | picture (literal) | set / framing | camera | face(s) | action / prop event on the stressed word | transition in | sfx |
|---|---|---|---|---|---|---|---|---|---|

Rules for filling it:
- **picture**: what a viewer with the sound off would see that makes this clause true. If you can't write it in one
  concrete line, the clause needs a device (§6, §7).
- **stressed word**: the one word that gets the event (the noun, verb or number). Faces land ~2 frames before it,
  gestures 2-5 frames before, a number's prop event ON it.
- **face**: the subject's expression type for this beat (deadpan, smug, rings, chevrons ...). Plan a new face roughly
  every beat on the subject, and a held deadpan after every dry line.
- **camera**: one move per beat at most (creep is the default between moves).
- **sfx**: only for an on-screen action (a pop, a clang, a whoosh on a real camera rush). 3-5 in the first 5-8 s,
  then about one every 3-5 s.

## 3. What to show for each kind of clause

| the clause is ... | show |
|---|---|
| "you" doing something | the hero doing exactly that, mid-action, in a dressed set |
| a concrete noun | that object appearing or changing within 0-10 frames of its word (it pops into a hand, onto a counter, a sign lights) |
| a number | a physical event ON its word: a counter landing, a button lighting, an object placed on a stack, a digit written |
| a place or a time | a wide or aerial that establishes it, with the information on a sign, a clock, a calendar or a screen in the world |
| an irony or a dry fact | the hero's deadpan face held ~1 s, with a small reaction push starting ~5 frames after the swap |
| a surprise / danger | a startle (hop or jolt) locked to the event, rings eyes, an alarm light or grade change on the word |
| "inside" something | fly through it: a door opens ahead of the camera, a pupil becomes a window, the front of a machine swings open |
| a mechanism or rule | a device that turns it into a place or an object (§6, §7) |
| a comparison | both things in one set, a whip pan from one to the other on the second one's word |
| repetition ("over and over") | a montage of the same action with an accelerating cadence and a counter ticking up |
| damage, heat, a body process | an insert: x-ray, cross-section or thermal view (§5) |
| the twist | a change in the place itself: the lights go red, the door is locked, the sign flips, the stack collapses |
| a quoted line someone says | that character on screen, one short line, the only time a mouth moves with words |

## 4. The camera across a shot

Every shot follows the same arc:
1. **Arrive moving.** Coming out of the transition the camera is already travelling and decelerates (ease-out over
   ~0.7-1.2 s). Never open on a parked camera.
2. **Live.** Between moves the camera creeps toward the subject (~5 % a second). Each beat may add one move:

| beat | move |
|---|---|
| a reaction (the hero reacts to something) | reaction push: +6-13 %, starting ~5 frames after the face swap, ease-out over ~1 s |
| a planned punchline | gag punch: +15 % over ~12 frames, ENDING on the frame the face changes |
| a character lands a big move | a small bump: +2.4 % over 9 frames |
| an impact | a flinch: pull back 12 % over 9 frames |
| a reveal ("it's an island", "the whole street") | pull-out to about half scale over 1-1.6 s, fast start, long settle |
| an object thrown or falling | tilt with it, settling on the impact frame |
| the next subject in the same set | a whip pan (12-16 frames), landing on the subject as its clause starts |
| a long prop with the answer on it (a list, a strip) | ride along it and stop with the key item centred on its word |
| a walker or runner | follow (accelerate with them, settle as they stop) |

3. **Leave accelerating.** In the last 0.6-1.0 s the camera speeds up (ease-in) toward the next shot's entry point and
   peaks on the middle frame of the transition. Exception: a calm change of topic may use a settle-dissolve (the camera
   rests 3-4 frames, then dissolves).

Full stops: at most 2 per short, each under a second, only for the key reveal, the empty frame before something smashes
in, a still HUD insert, or the final hold.

## 5. Connecting shots

| join | when | how |
|---|---|---|
| **cross-dissolve** (default) | every new sentence | 6 frames (4-8), starting 0-3 frames before the sentence's first word, both shots moving |
| **match dissolve** | the next picture can rhyme with this one: an eye -> a round object, a face -> a face, two round windows -> two eyes, a round hole -> a round rug | put the incoming hero exactly on the outgoing hero's feature: same screen spot, similar size; 6-8 frames |
| **fly-through** | going inside a building, room, vehicle, machine | the door / hatch / panel opens AHEAD of the camera; the camera crosses it at full speed (with or without a dissolve at that moment) and decelerates inside |
| **zoom-through an eye** | going into someone's mind or memory | rush into the pupil; the pupil becomes a round window showing the inside; rush again until the rim leaves the frame |
| **window zoom-through** | going into a diagram or cross-section | a white-outlined square opens on the target and grows, then fills the frame |
| **bubble iris** | a close-up of a feeling growing out of the hero | a soft circle holding the close-up grows out of the head in ~5 frames |
| **whip pan** | the next subject is in the same set | 12-16 frames; never across two places |
| **morph** | an object becomes a clearer model of the idea (a strip curls into a wheel) | 6 frames with the camera nearly still |
| **scan wipe** | the same shot switches to x-ray / blueprint and back | a glowing line sweeps the frame in ~10 frames |
| **flash cut** | a lightning strike, a camera flash, a shock | a hard cut hidden under a 3-frame white flash |
| **hard cut** | only: (1) match on action (an object falls out of the bottom, the next shot catches it at the top); (2) the same prop fills both shots; (3) the end of a rush from outside a place to inside it, or out of a zoom-through hole; (4) under a flash; (5) a quick action jump in the same set (at most once) | never a plain cut between unrelated shots |

Prefer **one-take chains** to cuts: walk -> gag -> crane up -> aerial; rip a poster -> whip back -> wide of the tree;
push to a door -> fly through -> down the corridor -> through the next door.

## 6. Inserts: when and how

| insert | use for | rules |
|---|---|---|
| satellite / map screen with a YOU marker | where and when (a storm coming, a distance, a day counter) | its own full-frame shot; a time title at the top, a sweep line revealing the danger, one alert pill popping in; one push onto the marker |
| x-ray of the hero | what is happening inside the body right now (a nerve, an organ, something swallowed) | a scan line converts the body (props stay normal); the organ or cord does one clear thing on the beat word; scan back out |
| x-ray of an object | the hidden part of a machine, a plant, a product | the object becomes a navy blueprint behind the scan line; one small label fades in |
| cross-section card | how damage or a process spreads through layers | entered by a window zoom-through; one change grows over ~12 frames |
| thermal view | heat, pain, effort, a fever | its own shot; false colours ramp over ~0.6 s, a readout climbs on its word |
| analogy cutaway | "it's like ..." with a familiar object | a short shot of the familiar object doing the same thing, then a pull-back that connects it to the story |
| re-enactment | a past event told by others | characters act it out with toys on a table, often in slow motion |
| period cameo | a historical figure with the same idea | the same character rig in a period set, acting only with the face |
| POV | "you see", falling asleep, losing sight | the hero's own arms and hands at the bottom of the frame; eyelids or a blur |

- An insert is 1.5-3 s, static or with one dedicated push. Never paste a HUD over a character shot.
- After an insert, come back to the hero for a reaction (a deadpan or a startle) within the next beat.

## 7. Making an abstract idea physical (the recipe)

1. Say the mechanism in one plain sentence ("The phone charges slower when it's nearly full").
2. Find its parts: the actor, the thing acted on, the limit or rule, the result.
3. Map them onto a familiar place or machine: a building, a garage, a kitchen, a factory line, a post office, a road.
4. Give the actors faces: they become characters with a job.
5. Make the rule a visible object: a sign, a gate, a dial, a list, a counter, a stamp.
6. Act the mechanism one step per clause.
7. Show the twist as a change in the place (the lights turn red, the gate shuts, the sign flips).
8. Cut back to the hero for the reaction.

## 8. Worked devices

Each device: what it is, when to use it, how to stage it, and a made-up example.

1. **Crack it open (dive into a machine).** For "how does this thing decide?". The hero glares at the machine (gritted
   teeth, a reach); the camera dives at it with an accelerating push (~0.8 s); the front panel swings open toward the
   lens in ~4 frames; a dissolve at full speed; inside, the camera keeps moving and settles on the part that matters.
   The idea comes out of that part as an object. *Example: a vending machine "eats" your coin. Inside, the coin rolls
   down a ramp past a gate with a sign; the gate flips to a red REJECT on "too light"; the camera rides the ramp to the
   reject cup.*
2. **The system as a building.** For any system with parts and signals. Its rooms are the parts, devices on the walls
   are sensors, and the workers are the messengers. A push up to the front door, a fly-through, a corridor of labelled
   doors. *Example: why you hear your own name across a noisy party. Inside the ear's building, rows of sleepy
   receptionists ignore a flood of letters; one letter has your name, and a single receptionist jolts awake as her desk
   lamp turns red.*
3. **The control room behind the eyes.** For thinking, memory, attention. Zoom through the pupil into a room whose round
   windows ARE the eyes, where a small worker character runs the show at a desk. *Example: why you can't tickle
   yourself. The worker sees the hand's plan on a forecast board, stamps it EXPECTED, and the big red "laugh" button
   stays under its cover.*
4. **The counter that lands on the word.** For any amount that grows. A display or sign rolls from 0 to the number in
   ~0.7 s, with growing steps and a 1-2 frame hold or two, landing exactly on the spoken number. *Example: "a busy
   kitchen tap runs ninety litres a day": a meter on the wall rolls and lands on "ninety".*
5. **A run of lights for a range.** For "from X all the way to Y". A finger slides along a panel at constant speed;
   the first button lights on the first spoken value and the last on the last. Dim the other group to emphasise one.
   *Example: an oven dial: the marks from 100 to 250 light under the hero's finger as the narration counts up; the low
   marks dim on "only the top ones matter".*
6. **A distribution as a skyline.** For "how common is each". Buildings shaped like the categories rise out of the
   ground one after another (3-4 frames apart), tall for common, short for rare; the hero walks down the street.
   *Example: birthdays by month: twelve month-shaped towers grow along a boulevard, and two summer towers dwarf the
   rest.*
7. **A sample as a grid board.** For "out of N people / N tries". N small objects pour into a 10 x 10 tray, row by
   row; then the ones that matter light up one every ~2 frames and a hand-drawn red ring circles them. *Example: one in
   ten people is left-handed: a hundred tiny figurines pour in, ten of them raise their left hands, and a pencil circles
   them.*
8. **A bar chart made of real objects.** For comparing amounts. Stack the actual thing (mugs, books, bricks) over a
   labelled ledge; a character adds one to each stack on its spoken value. *Example: coffee by age: a barista adds mugs
   to stacks labelled 20s, 30s, 40s as each number is spoken.*
9. **A depth column you sink through.** For stages or levels of a state. A cut-away column of water or ground with
   labelled bands and a depth ruler; the hero sinks slowly through it; the light cools as they go deeper; a line graph
   draws itself down the side. *Example: how deep a habit goes: the hero sinks through bands labelled TRYING, ROUTINE
   and AUTOPILOT, each one darker and quieter.*
10. **A dial for a state.** For a level that goes up and down. A fuel gauge, a pressure dial or an elevator floor
    indicator whose needle swings while the world around it changes. *Example: an after-lunch sugar crash: a car-style
    fuel gauge on the hero's desk swings from FULL to FUMES, and the hero's eyelids drop a notch with each tick.*
11. **Ideas on a corkboard.** For combining ideas. Cards with simple icons; strings draw pin to pin (~5 frames each);
    two cards slide together and a bigger new card pops out (1.15 -> 1.0 in 2 frames) with "!!". *Example: WHEEL +
    SUITCASE slide together and pop into ROLLING SUITCASE.*
12. **The x-ray with a signal.** For a nerve, a signal, something switched on or off inside. A scan line turns the
    hero translucent; a cord runs from the brain to the limb; it glows taut when on and hangs slack and grey when off,
    switching in 1-2 frames on the beat word. *Example: your foot falls asleep: you sit on it, the cord to the foot goes
    slack and grey; you stand, it snaps taut and sparkles as the pins and needles hit.*
13. **The satellite screen.** For where, when and what's coming. Its own shot: a dark map, a YOU marker, a day/time
    title, a sweep line revealing the threat, an alert pill popping in, then a push onto the marker. *Example: lost on a
    lake: DAY 2, 4:10 PM, a sweep reveals a fog bank rolling toward the YOU dot.*
14. **The cross-section window.** For what happens under a surface. A white square opens on the spot, grows and fills
    the frame; layered tissue or ground; one change grows over ~12 frames; a dome swells with an ease-out. *Example: a
    mosquito bite: tiny alarmed cells ring bells under the skin and the bump swells.*
15. **The thermal view.** For heat, pain, effort. Its own shot through a "camera": colours ramp from cool to hot, a
    readout climbs on its word. *Example: why chili feels hot: the mouth glows yellow on the thermal view while a
    thermometer prop in the corner of the set stays normal.*
16. **The analogy object.** For "it does to X what Y does to Z". A short cut to a familiar object getting the same
    treatment, then a pull-back that ties it to the story. *Example: why sunscreen matters: a bright poster in a sunny
    shop window fades to grey in seconds, and a pull-back shows the hero's shoulder going pink next to it.*
17. **The friendly label torn off.** For "this thing is dangerous / not what it seems". A friendly label or poster on
    the thing tears away (rotates and tumbles off in ~12 frames) to reveal a warning mark of your own design
    underneath. *Example: a smiling "PET ME" card on a jellyfish tank peels off to show black-and-yellow hazard stripes;
    the hero takes one step back.*
18. **The repetition montage.** For "again and again". A tally counter slides in; a stamper hits row after row with an
    accelerating rhythm (gaps of 14, 9, 6, 4, 3 frames) while the camera tilts at a steady speed. *Example: a toddler's
    questions: a stamper hits WHY? WHY? WHY? down a long scroll while a "patience" counter on the parent's desk ticks
    down.*
19. **The toy re-enactment.** For an event told second-hand. A group around a table acts it out with toys, in slow
    motion, debris hanging in the air. *Example: a support group of burnt toasters re-enacts the morning a fork went in
    the slot.*
20. **Data with faces.** For "the numbers give it away". The digits or items grow eyes one by one on the word and all
    look at the guilty one. *Example: on a supermarket receipt, every price turns to stare at the one that's wrong.*
21. **The journey of a small thing.** For "where does it go?". Follow the thing (with a face) through the system like a
    traveller, with signs giving the direction and time of each stage, falling, sliding, riding. *Example: a raindrop's
    trip from a roof to a tap: it slides down a gutter past a sign "PIPE 3 ->", splashes through a filter gate and pops
    out of the tap into a glass.*
22. **Devices that wake up.** For sensors and alarms. A wall full of sleepy devices with faces; one wakes (a 1-frame
    eye-open), the light turns red on the word, and helpers rush to quiet it. *Example: a kitchen wall of sleepy egg
    timers; one rings on "burnt", and the whole room flashes red.*
23. **The stack that becomes the next prop.** For "it keeps piling up". Papers or notes pile up on a worker's desk; a
    hard match cut puts the same stack in the hero's hands in the next scene. *Example: why a to-do list never ends: a
    clerk keeps adding sticky notes to a tower; the tower matches into the hero's arms walking into a meeting.*
24. **The bookend prop.** For a satisfying end. The prop from the first shot returns in the last, changed. *Example:
    the opening shot measures a tiny sapling with a tape measure; the closing shot's tape measure can't reach the top
    of the grown tree.*

## 9. Example storyboard (from the example script in script.md)

| # | time | say | picture | set / framing | camera | face | event on the stressed word | in |
|---|---|---|---|---|---|---|---|---|
| 1 | 0.0 | Your phone is at 1 % | a red 1 % battery icon on a phone screen, a cable already sliding in | bedside table at night, ecu | pull-out from the screen past the hero's shoulder to an mcu by 1.3 s | annoyed half-lid | the plug clicks in on "plug" | (start, mid-action) |
| 2 | 1.4 | For the first twenty minutes | the battery fills fast; a bedside clock flicks forward | same, ms | creep | hopeful, then smug | the clock jumps to +20 min on "twenty" | beat |
| 3 | 2.6 | it charges like crazy | the counter races 1 -> 60 % | same, cu on the phone | quick push | excited rings | counter lands on 60 on "crazy" | beat |
| 4 | 3.6 | Then it crawls. | the counter drips 60, 61 ... | same, cu on the hero | reaction push | deadpan, held ~1 s | counter ticks once on "crawls" | beat |
| 5 | 4.8 | Picture your battery as a parking garage. | the phone grows into a multi-storey garage with a battery-shaped sign | street at dusk, ws | accelerating push into a match dissolve: the phone's outline -> the garage's facade | | the garage sign lights on "garage" | match dissolve |
| 6 | 6.6 | Each charge is a car looking for a spot. | little cars with faces stream in through the gate | garage ramp, ms | follow the lead car | cars: eager | the gate arm lifts on "car" | fly-through the gate |
| 7 | 8.4 | When it's empty, they park anywhere. | cars dart into free spaces on floor 1 | floor 1, ws | whip to the cars parking | cars: happy | three cars park on "anywhere" (sfx: 3 small pops) | beat |
| 8 | 10.0 | But near the top, every car has to search. | one car circles a nearly full top floor | top floor, ms | slow follow | car: squinting, sweat drop | the FULL sign flicks on on "search" | dissolve |
| 9 | 11.8 | So your phone slows down on purpose | an attendant waves cars in one at a time | top floor, mcu on the attendant | reaction push | attendant: smug | stop-hand on "purpose" | beat |
| 10 | 13.4 | to stop a pile-up. | a brief vision of cars stacked crookedly, then gone | same, ws | flinch on the pile-up | hero (cutaway): rings | the stack wobbles on "pile-up" (sfx: crash, -10) | flash cut and back |
| 11 | 14.8 | That's why 80 % takes half an hour | a floor sign "80" and a wall clock ticking | ramp, ms | ride up the ramp | | the clock hand sweeps on "half an hour" | dissolve |
| 12 | 16.6 | and the last 20 % takes the rest of the night. | the bedroom: the hero asleep, the phone at 1 % again | bedroom, mcu | settle, then the final hold | asleep, then one eye opens | the icon flips back to 1 % on "night" (loop) | match dissolve: the garage's top-floor window -> the phone screen |

## 10. Before you build: storyboard checklist

- [ ] Every sentence starts a shot; every clause has a beat; no gap over 1.5 s without a change.
- [ ] Frame 1 is mid-action; the hook pays off by ~2-3 s.
- [ ] Every number has a prop event on its word; every concrete noun gets its picture within ~0.3 s.
- [ ] Every shot arrives moving and leaves accelerating; at most 2 planned stops.
- [ ] Transitions: dissolves by default; every hard cut is one of the five cases; whips only within a set.
- [ ] At least one device that makes the mechanism physical; at most one or two inserts, each followed by a reaction.
- [ ] The hero's face changes about every beat; a deadpan hold after each dry line.
- [ ] Faces and key props are planned above the caption band (66-76 % of the height).
- [ ] The last shot returns to the first shot's place or prop (the loop).
