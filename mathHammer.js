const MathHammer = (function() {

        /* ===== PRIVATE VARIABLES ===== */

        let combatants = {
            attacker: {
                models: [],
                weapons: []
            },
            defender: {
                models: [],
                weapons: []
            }
        };

        const selectHandlers = {
            model:  selectModel,
            weapon: selectWeapon,
        };
        const inputHandlers = {
            model:  updateModel,
            weapon: updateWeapon,
        };


        /* ===== PRIVATE FUNCTIONS ===== */

        function pasteHandler(e) {
            const clipboardData = e.originalEvent.clipboardData;

            // HTML version (what you want)
            const html = clipboardData.getData('text/html');

            // Plain text fallback
            const text = clipboardData.getData('text/plain');

            let wahaURL = 'https://wahapedia.ru';

            var isAttacker = $(e.target).prop('id').startsWith('attacker');

            if (html) {
                addToDOM(html);
                parseHTML(isAttacker);
            } else if (text.startsWith(wahaURL)) {
                parseURL(isAttacker, text);
            } else {
                parseText(isAttacker, text);
            }
        }

        function addToDOM(html) {
            var domdiv = $('#pastedom');

            domdiv.empty();
            domdiv.append($(html));
        }

        function parseHTML(isAttacker) {
            var side = isAttacker ? 'attacker' : 'defender';

            var $header = $('#pastedom .dsH2Header');
            var $modelStat = $('#pastedom .dsProfileBaseWrap');
            var $weaponStat = $('#pastedom .wTable .bkg');
            var $modelSpecialRules = $('#pastedom .dsRightСol');
            var $keywords = $('#pastedom .ds2colKW');

            var aSpecial = ['Feel No Pain', 'Invulnerable', 'Vanguard Predator:','Stealth'];
            var aSpecialAcronyms = { // add any special rules you want to be automatically abbreviated here, the key is the full text that appears on wahapedia and the value is the abbreviation you want to see in the output. The parser looks for the full text as a substring of the special rules, so it should still work if there are numbers or other words in the special rule (e.g. "Feel No Pain 5+" will still be recognized and abbreviated as "FNP 5+")
                'Feel No Pain': 'FNP',
                Invulnerable: 'Inv',
                'Vanguard Predator:': 'Vanguard Predator, reroll-hits 1',
            };

            //clear out combatants
            combatants[side].models.length = 0;
            combatants[side].weapons.length = 0;


            $modelStat.each(function() {
                
                let name = $(this).find('.dsProfileWrapRight span').first().text();

                let charClass = '.dsCharWrap';
                if (!$(this).find('.dsCharWrap').length)
                    charClass = '.dsCharWrapM';

                let move = $(this).find(charClass).eq(0).find('.dsCharValue').text();
                let toughness = $(this).find(charClass).eq(1).find('.dsCharValue').text();
                let save = $(this).find(charClass).eq(2).find('.dsCharValue').text();
                let wounds = $(this).find(charClass).eq(3).find('.dsCharValue').text();
                let leadership = $(this).find(charClass).eq(4).find('.dsCharValue').text();
                let oc = $(this).find(charClass).eq(5).find('.dsCharValue').text();
                let invuln = $(this).next('.dsInvulWrap').find('.dsCharInvulValue').text();

                if (!name)
                    name = $header.find('>div').text();

                combatants[side].models.push({
                    count: 1,
                    name: name,
                    move: move,
                    toughness: toughness,
                    save: save,
                    invuln: invuln,
                    wounds: wounds,
                    leadership: leadership,
                    objective_control: oc,
                    special: [],
                    keywords: {},
                    checked: false
                });
            });

            combatants[side].models[0].checked = true; // default to first model being selected, user can uncheck in UI


            let special = [];
            $modelSpecialRules.find('.dsAbility').each(function() {

                let getAbilities = function() {
                    let abilities = $(this).text().replace(/\u00A0/g, ' ');
                    let aFound = arrayElementAsSubstring(abilities, aSpecial);
                    for (let ability of aFound) {
                        for (let phrase of arrayElementAsSubstring(ability, Object.getOwnPropertyNames(aSpecialAcronyms), )) {
                            let acronym = aSpecialAcronyms[phrase];
                            abilities = abilities.replace(phrase, acronym);
                        }
                    }
                    if (aFound.length)
                        special.push(abilities.replace(/\u00A0/g, ' '));
                };

                $(this).find('[data-tooltip-content]').each(getAbilities);
                $(this).children().first().each(getAbilities);
            });

            combatants[side].models.forEach(model => {
                model.special = special.filter(s => s.toLowerCase().includes(model.name.toLowerCase()+' only'));
            });

            $weaponStat.find('>tr').each(function() {
                
                let $nameCells = $(this).find('.wTable2_short>span').clone();
                $nameCells.find('span').remove();

                const aWeaponKeywords = [];

                $(this).find('.wTable2_short>span>span').each(function() {
                    let keyword = $(this).text().trim();
                    if (keyword)
                        aWeaponKeywords.push(keyword.replace(/\u00A0/g, ' '));
                });

                let weapon = {
                    name: $nameCells.text(),
                    range: $(this).find('.wTable2_short').siblings().eq(1).text().trim(),
                    attacks: $(this).find('.wTable2_short').siblings().eq(2).text().trim(),
                    skill: $(this).find('.wTable2_short').siblings().eq(3).text().trim(),
                    strength: $(this).find('.wTable2_short').siblings().eq(4).text().trim(),
                    ap: $(this).find('.wTable2_short').siblings().eq(5).text().trim(),
                    damage: $(this).find('.wTable2_short').siblings().eq(6).text().trim(),
                    special: aWeaponKeywords,
                    checked: true, // default to all weapons being selected, user can uncheck in UI
                };

                if (weapon.name) {
                    combatants[side].weapons.push(weapon);
                }
            });


            var getKeywords = function(element) {
                let sibling = $(element.nextElementSibling);
                do {
                    if ($(sibling).text().trim()) {
                        return $(sibling).text().trim().split(',').map(keyword => keyword.trim().toTitleCase());
                    }
                    sibling = $(sibling).next();
                } while (sibling.length);

                return [];
            }

            let keyWords = {    all:        [],
                                faction:    [],
            };

            $keywords.find('>div').each(function(){
                $(this).contents().filter((index, elem) => elem.nodeType == 3).each(function(){
                    if (this.textContent == 'KEYWORDS – ALL MODELS:' || this.textContent == 'KEYWORDS:') {
                        keyWords.all = getKeywords(this);
                    }
                    else if (this.textContent == 'FACTION KEYWORDS:') {
                        keyWords.faction = getKeywords(this);
                    }
                    else if (this.textContent.includes('ONLY:')) {
                        let model = this.textContent.split('ONLY:')[0].trim();
                        keyWords[model.toTitleCase()] = getKeywords(this);
                    }
                });
            });



            for ( let type of Object.keys(keyWords)) {
                if (keyWords[type].length) {

                    for (let model of combatants[side].models) {
                        if (type == 'all' || type == 'faction' || (type == model.name)) {
                            let keywordsType = type == 'all' || type == 'faction' ? type : 'model';
                            model.keywords[keywordsType] = keyWords[type];
                        }
                    }
                }
            }

            renderModels(side);
            if (isAttacker) {
                renderWeapons();
            }
        }


        function renderModels(side) {

            let models = combatants[side].models;
            let $section = $('#modelSection .' + side);

            $section.find('.modelGrid .body').not(':first').remove();

            let $template = $section.find('.modelGrid .body').first();
            $template.find('span.name').text('');
            $template.find('input, textarea').val('');

            models.forEach((model, i) => {

                let $row = i === 0
                    ? $template
                    : $template.clone().appendTo($section.find('.modelGrid'));

                $row.data('name', model.name); // store model name in row data for easy lookup later
                $row.find('.count').val(model.count);
                $row.find('.name').text(model.name);
                $row.find('.move').val(model.move);
                $row.find('.toughness').val(model.toughness);
                $row.find('.save').val(model.save);
                $row.find('.invuln').val(model.invuln);
                $row.find('.wounds').val(model.wounds);
                $row.find('.leadership').val(model.leadership);
                $row.find('.objective_control').val(model.objective_control);
                $row.find('.keywords').val(Object.values(model.keywords).flat().join(', '));
                $row.find('.special').val(model.special);
                $row.find('input[type="radio"]').prop('checked', false);
 
            });

            let checkedModel = models.find(model => model.checked);
            if (checkedModel) {
                $section.find('.modelGrid .body').filter((index, row) => $(row).data('name') === checkedModel.name).find('input[type="radio"]').prop('checked', true);
            }

            $section.find('textarea').each(function() {
                $(this).height(0);
                $(this).height(this.scrollHeight);
            });
            
            checkButton();
        }     
        

        function renderWeapons() {
            const side = 'attacker'; // side is always attacker, we don't render the defender weapons as they don't affect the calculations
            const weapons = combatants[side].weapons;
            const $section = $('#weaponSection');

            // Reset UI rows
            $section.find('.weaponGrid .body').not(':first').remove();

            let $template = $section.find('.weaponGrid .body').first();

            $template.find('span.name').text('');
            $template.find('input, textarea').val('');

            weapons.forEach((weapon, i) => {

                let $row = i === 0
                    ? $template
                    : $template.clone().appendTo($section.find('.weaponGrid'));

                $row.data('name', weapon.name); // store weapon name in row data for easy lookup later
                $row.find('.name').text(weapon.name);
                $row.find('.range').val(weapon.range);
                $row.find('.attacks').val(weapon.attacks);
                $row.find('.skill').val(weapon.skill);
                $row.find('.strength').val(weapon.strength);
                $row.find('.ap').val(weapon.ap);
                $row.find('.damage').val(weapon.damage);
                $row.find('.special').val(weapon.special);
                $row.find('.check').prop('checked', weapon.checked);
            });

            $section.find('textarea').each(function() {
                $(this).height(0);
                $(this).height(this.scrollHeight);
            });

            checkButton();
        }

        function swapSides() {

            // Swap stored data
            [combatants.attacker, combatants.defender] =
            [combatants.defender, combatants.attacker];

            let attackerText = $('#attackerPaste').val();
            let defenderText = $('#defenderPaste').val();

            $('#attackerPaste').val(defenderText);
            $('#defenderPaste').val(attackerText);

            renderUI();
            
        }

        function renderUI() {
            renderModels('attacker');
            renderModels('defender');

            renderWeapons(); // only attacker weapons shown

            checkButton();
        }

        function showMessage(message) {
            $('#combatSection').append('<div class="message">' + message + '</div>');
        }

        // helper function that takes a string and an array of substrings, and returns an array of the substrings that are found in the string. 
        // Used for parsing special rules and keywords from the HTML, where the full text of the special rule or keyword is included in a longer string of text
        function arrayElementAsSubstring(string, array) {
            var found = [];
            $.each(array, function(index, val) {
                if (string.replace(/\u00A0/g, ' ').includes(val)) {
                    found.push(val.replace(/\u00A0/g, ' '));
                }
            });
            return found;
        }


        function parseURL(isAttacker, text) {
            alert("Can't parse URLs yet, try copying the page content");
        }


        function checkButton() {
            var $modelSection = $('#modelSection');
            var $weaponSection = $('#weaponSection');

            var attackerPopulated = !!$modelSection.find('.attacker .modelGrid .body span.name').text().trim();
            var defenderPopulated = !!$modelSection.find('.defender .modelGrid .body span.name').text().trim();
            var weaponPopulated = !!$weaponSection.find('.weaponGrid .body span.name').text().trim();
            var weaponChosen = !!$weaponSection.find('.weaponGrid .body input.check:checked', ).length;

            $('#buttonSection .calculate').toggle(attackerPopulated && defenderPopulated && weaponPopulated && weaponChosen, );
            $('#buttonSection .attacker_warning').toggle(!attackerPopulated);
            $('#buttonSection .defender_warning').toggle(!defenderPopulated);
            $('#buttonSection .weapon_warning').toggle(!weaponPopulated || !weaponChosen);
        }

        // main function that gets called when you click calculate, it gathers all the info from the model and weapon grids, checks for errors, 
        // and then runs the calculations for each weapon and outputs the results to the combat section. isShooting is a boolean that indicates whether to calculate shooting or melee combat
        function calculate(isShooting) {
            $('#buttonSection .shooting_warning').hide();
            $('#buttonSection .melee_warning').hide();

            var attacker = combatants.attacker.models.find(model => model.checked);
            var defender = combatants.defender.models.find(model => model.checked);
            
            var weapons = {
                ranged: [],
                melee: []
            };

            weapons.ranged = combatants.attacker.weapons.filter(weapon => weapon.checked && (weapon.range.toLowerCase() != 'melee'));
            weapons.melee = combatants.attacker.weapons.filter(weapon => weapon.checked && (weapon.range.toLowerCase() == 'melee' || weapon.special.some(s => s.toLowerCase().includes('pistol'))));
            
            if (isShooting && !weapons.ranged.length) {
                $('#buttonSection .shooting_warning').show();
                return;
            }
            if (!isShooting && !weapons.melee.length) {
                $('#buttonSection .melee_warning').show();
                return;
            }

            $('#combatSection').empty();

            for (let weapon of isShooting ? weapons.ranged : weapons.melee) {
                // Initial attacks
                let rerollhits = 0;
                let rerollwounds = 0;
                let susHits = 0;
                let rerollHitsRule = '';
                let rerollWoundsRule = '';
                let susHitsStr = '';
                let dmgRule = '';
                let hitRule = '';
                let blast = 0;

                let hitMod = parseInt($('.hit_mod').val());
                hitMod = hitMod ? (hitMod > 0 ? '+' : '') + hitMod : '';

                let woundMod = parseInt($('.wound_mod').val());
                woundMod = woundMod ? (woundMod > 0 ? '+' : '') + woundMod : '';

                

                attacker.special.hasSpecial('reroll-hits', (num) => { //
                    if (rerollhits < parseInt(num)) {
                        attacker.special.hasSpecial('Vanguard Predator', () => { rerollHitsRule = 'Vanguard Predator'; });
                        rerollhits = parseInt(num);
                    }
                });
                attacker.special.hasSpecial('reroll-wounds', (num) => {
                    if (rerollwounds < parseInt(num)) {
                        attacker.special.hasSpecial('Vanguard Predator', () => { rerollWoundsRule = 'Vanguard Predator'; });
                        rerollwounds = parseInt(num);
                    }
                });

                weapon.special.hasSpecial('reroll-hits', (num) => {
                    if (rerollhits < parseInt(num)) {
                        rerollhits = parseInt(num);
                    }
                });
                weapon.special.hasSpecial('reroll-wounds', (num) => {
                    if (rerollwounds < parseInt(num)) {
                        rerollwounds = parseInt(num);
                    }
                });

                weapon.special.hasSpecial('twin-linked', (num) => {
                    if (rerollwounds < 6) {
                        rerollwounds = 6;
                        rerollWoundsRule = 'Twin-linked';
                    }
                });
                weapon.special.hasSpecial('sustained hits', (num) => {
                    susHitsStr = num;
                    susHits = getAvg(susHitsStr);
                });

                let anti_message = '';
                let anti_crit = null;

                // look for anti- keywords in weapon special rules, if found, check if defender has that keyword, if so, apply the critical hit threshold to wound rolls
                weapon.special.hasSpecial('anti-', (type, keyword) => {
                    type = type.replace(/\s+/g, ' ').trim();
                    let match = type.match(/(\d+\+)$/); // match a number followed by + at the end of the string, which indicates critical hit threshold for anti-weapon special rules (e.g. "Anti-Infantry 3+" means that the weapon scores a critical hit on rolls of 3+ against infantry units)
                    if (!match) return;

                    let roll = match[1];
                    type = type.slice(0, match.index).trim().toLowerCase();

                    if (defender.keywords.all && defender.keywords.all.map(k => k.toLowerCase()).includes(type) || 
                        defender.keywords.faction && defender.keywords.faction.map(k => k.toLowerCase()).includes(type) || 
                        defender.keywords.model && defender.keywords.model.map(k => k.toLowerCase()).includes(type)) {

                        anti_message = 'anti-' + type.toTitleCase() +' ' + roll;
                        if (anti_crit === null ||parseInt(roll) < anti_crit) {
                            anti_crit = parseInt(roll);
                        }
                    }               
                });

                weapon.special.hasSpecial('blast', (num) => {
                    blast = Math.floor(defender.count / 5);
                });
                
                let halfRange = !!$('.half_range:checked').length;

                showMessage('Attacker weapon: ' + weapon.name);

                let score = (getAvg(weapon.attacks) + blast) * attacker.count; // add blast hits to attacks, and multiply by number of models to get total attacks
                let torrent = weapon.special.includes('torrent');

                if (halfRange) weapon.special.hasSpecial('rapid fire', (rapidFireNum) => { 
                    weapon.attacks = modDice(weapon.attacks, rapidFireNum);
                    score += getAvg(rapidFireNum); 
                    hitRule = "Rapid fire "+rapidFireNum;	
                });

                if (attacker.count > 1 || defender.count > 1) {
                    showMessage(attacker.count + ' models attacking & ' + defender.count + ' models defending');
                }   

                showMessage('Roll to hit: ' + weapon.attacks + (blast ? ' + ' + blast + ' blast' : '') + ' attacks' + (attacker.count > 1 ? ' each' : '') + (hitRule ? " ("+hitRule+") " : "") + ", "+(hitMod ? ' (' + hitMod + ' mod) ' : '') + 'hitting ' + (torrent ? 'automatically' : 'on ' + weapon.skill.replace('+', 's') + (rerollhits ? ', rerolling ' + (rerollhits < 6 ? rerollhits + 's' : 'misses') + (rerollHitsRule ? ' (' + rerollHitsRule + ')' : '') : '')), );

                // to hit roll
                susHits = calcDiceRoll(score, '6+', 0, rerollhits) * susHits;
                score = score + susHits;

                let critHits = 0;
                if (weapon.special.includes('lethal hits')) {
                    critHits = calcDiceRoll(score, '6+', 0, rerollhits);
                }
                score = calcDiceRoll(score, torrent ? '1+' : weapon.skill, hitMod, rerollhits);

                showMessage('Avg Total: ' + Math.roundTo(score, 4) + ' hits' + (susHits ? ' (including ' + Math.roundTo(susHits, 4) + ' sustained hits)' : ''), );

                // to wound roll
                let strength = weapon.strength.toLowerCase() == 'user' ? attacker.strength : getAvg(weapon.strength);
                let strengthStr = weapon.strength.toLowerCase() == 'user' ? 'user (' + attacker.strength + ')' : weapon.strength;
                let woundRoll = getWoundRoll(strength, defender.toughness);
                if (parseInt(woundRoll) >= anti_crit && anti_crit !== null) {
                    woundRoll = anti_crit + '+';
                }
                showMessage('Roll to wound: Strength ' + strengthStr + ', toughness ' + defender.toughness + (woundMod ? ' (' + woundMod + ' mod) ' : '') + ' ' +anti_message + ' - wounding on ' + woundRoll.replace('+', 's') + (rerollwounds ? ', rerolling ' + (rerollwounds < 6 ? rerollwounds + 's' : 'misses') + (rerollWoundsRule ? ' (' + rerollWoundsRule + ')' : '') : ''), );

                if (critHits) {
                    showMessage('Lethal hits: ' + Math.roundTo(critHits, 4) + ' hits auto-wound', );
                }

                let critWounds = calcDiceRoll(score, (anti_crit ? anti_crit + '+': '6+'), 0, rerollwounds);
                score = calcDiceRoll(score - critHits, woundRoll, woundMod, rerollwounds) + critHits;
                showMessage('Avg Total: ' + Math.roundTo(score, 4) + ' wounds');

                // armour save
                let save = defender.save;

                if (weapon.ap.includes('-')) {
                    let apParts = weapon.ap.split('-');
                    let saveParts = defender.save.split('+');
                    save = parseInt(saveParts[0]) + parseInt(apParts[1]);
                    save += '+';
                }

                let apMessage = weapon.ap && weapon.ap != '0' ? ' reduced to ' + save : '';

                let saveParts = save.split('+');
                let invulnParts = defender.invuln.split('+');
                let invulnMessage = defender.invuln ? ' | Invuln:' + defender.invuln + (parseInt(invulnParts[0]) < parseInt(saveParts[0]) ? ' is better than ' + save : '') : '';
                if (parseInt(invulnParts[0]) < parseInt(saveParts[0]))
                    save = defender.invuln;
                save = Math.min(7, parseInt(save.split('+')[0])) + '+';

                showMessage('Armour save: ' + defender.save + apMessage + invulnMessage + ' | ' + (parseInt(save.split('+')[0]) > 6 ? "can't save" : 'blocking on ' + save.split('+')[0] + 's'), );

                if (weapon.special.includes('devastating wounds')) {
                    showMessage('Devastating Wounds: ' + Math.roundTo(critWounds, 4) + ' cannot be saved', );
                    score = calcBlockDiceRoll(score - critWounds, save) + critWounds;
                } else {
                    score = calcBlockDiceRoll(score, save);
                }

                showMessage('Avg Total: ' + Math.roundTo(score, 4) + ' wounds');

                if (weapon.special.includes('melta') && halfRange) {
                    let melta = weapon.special.split('melta')[1].split(/[,\n]/)[0].trim().toUpperCase();
                    dmgRule = "Melta "+melta;
                    weapon.damage = modDice(weapon.damage, melta);
                }

                showMessage(weapon.damage + ' dmg per wound' + (dmgRule ? " ("+dmgRule+") " : "") + (parseInt(defender.wounds) < parseInt(getAvg(weapon.damage)) ? ' | target can only lose ' + defender.wounds + ' wounds' : ''), );
                score = score * Math.min(getAvg(weapon.damage), defender.wounds);

                showMessage('Avg Total: ' + Math.roundTo(score, 4) + ' wounds lost', );

                if (defender.special.includes('FNP')) {
                    let fnp = defender.special.split('FNP')[1].split('+')[0];

                    showMessage('Feel No Pain roll, blocks damage on ' + fnp + 's');
                    score = calcBlockDiceRoll(score, fnp + '+');
                    showMessage('Avg Total: ' + Math.roundTo(score, 4) + ' wounds lost', );
                }

                let targetWounds = defender.wounds * defender.count;
                let woundsPerAttacker = score / attacker.count;
                let attackersNeeded = Math.roundTo(targetWounds / woundsPerAttacker, 4);
                let attackersToKillOne = Math.roundTo(parseInt(defender.wounds) / woundsPerAttacker, 4);
                let defendersKilled = Math.roundTo(score / parseInt(defender.wounds), 4);

                let attackerName = attacker.name + (attacker.name.substr(attacker.name.length - 1) != 's' ? 's' : ''); 
                let defenderName = defender.name + (defender.name.substr(defender.name.length - 1) != 's' ? 's' : ''); 

                if (score < targetWounds) {
                    showMessage('You would need ' +attackersNeeded + ' ' + attackerName + ' to kill ' + defender.count + ' ' + defenderName + ' in 1 round');
                } else {
                    showMessage(attacker.count + ' ' + attackerName + ' can kill ' + defendersKilled + ' ' + defenderName + ' in 1 round');
                }
                if (attackersNeeded / defender.count > 1) {
                    showMessage('You would need ' + Math.roundTo(attackersNeeded / defender.count, 4) + ' ' + attackerName + ' to kill 1 ' + defenderName + ' in 1 round');
                }
                if (defendersKilled > 1) {
                    showMessage(attacker.count + ' ' + attackerName + ' would kill ' + Math.roundTo(defendersKilled / attacker.count, 4) + ' ' + defenderName + ' each in 1 round');
                }
                if (attackersNeeded / defender.count < 1) {
                    showMessage('1 ' + attackerName + ' would kill ' + Math.roundTo(defendersKilled / attacker.count, 4) + ' ' + defenderName + ' in 1 round');
                }

                showMessage('');
            }
        }

        
        // calculates how many hits you would get on average given a certain number of attacks, a hit threshold, and modifiers. 
        // For example, if you have 10 attacks, need to hit on 3+, and have a +1 modifier, it calculates how many hits you would get on average (in this case, 6.667). 
        // It also takes into account rerolls - for example, if you have the same scenario but can reroll misses, it calculates how many hits you would get on average with the reroll (in this case, 7.778)
        function calcDiceRoll(scoreIn, successNeeded, modifier = 0, rerolls=0, diceSides=6) {

            if (successNeeded == "1+") return scoreIn; // 1+ is a special case for things like Torrent, where hit-rolls auto-succeed

            modifier = parseInt(modifier || 0);
            let successInt = parseInt(successNeeded.replace('+', ''));

            // could do this with a single calculation, but it's not time-critical and I think iterating is conceptually easier to understand
            const rolls = [...Array(diceSides).keys()].map(i => i + 1);// [1, 2, 3, 4, 5, 6, etc]
            let hitRate = 0;
            for (roll of rolls) { 
                if (roll == diceSides) {	// unmodified max number is always a success
                    hitRate++;
                } else if (roll + modifier >= successInt && roll > 1) {
                    hitRate++; // unmodified 1 is always a failure
                }
            }
            // normalise it
            hitRate = hitRate / diceSides;

            let hitScore = scoreIn * hitRate;

            if (!rerolls)
                return hitScore;

            let rerollScore = scoreIn * (1 - hitRate); // work out how many failed
            rerollScore = calcDiceRoll(rerollScore, successNeeded, modifier); // roll those again

            return hitScore + rerollScore;

        }
        // calculates how many hits are blocked by a save, given the number of hits and the save threshold. 
        // For example, if you have 10 hits and a save of 3+, it calculates how many of those 10 hits would be saved on average (in this case, 6.667) and returns the number of hits that get through (in this case, 3.333)
        function calcBlockDiceRoll(scoreIn, successNeeded) {
            successNeeded = parseInt(successNeeded.replace('+', ''));

            if (successNeeded > 6)
                return scoreIn;
            if (successNeeded < 1)
                return 0;

            let prob = (successNeeded - 1) / 6;

            return scoreIn * prob;
        }

        // takes a dice string like "2D6+3" and a modifier like 1, and returns the modified dice string, in this case "2D6+4". 
        // If the original string is just a number, it adds the modifier to that number instead (e.g. "3" with a modifier of 2 becomes "5"). 
        // If the original string has no modifier, it adds one (e.g. "2D6" with a modifier of -1 becomes "2D6-1")
        function modDice(diceStr, modifier) {
            diceStr = diceStr.toString();
            let diceNum = 0;
            let diceSize = 0;
            let intDmg = 0;
            let damageParts = diceStr.split("D");
            if (damageParts.length == 1) {

                intDmg = parseInt(damageParts[0]);
            } else {

                diceNum = damageParts[0];
                damageParts = damageParts[1].split(/[+-]/);
                diceSize = damageParts[0];
                if (damageParts.length > 1) {
                    intDmg = parseInt((diceStr.includes('-') ? "-" : "") + damageParts[1]);	
                }
            }

            intDmg += parseInt(modifier);

            if (!diceSize) return intDmg;
            if (!intDmg) return diceNum+"D"+diceSize;
            return diceNum+"D"+diceSize+(intDmg >= 0 ? '+' : '')+intDmg;
        }

        // returns a string like "3+" based on the strength and toughness values, using 40k wound roll rules
        function getWoundRoll(skill, toughness) { 
            
            skill = parseInt(skill);
            toughness = parseInt(toughness);

            if (skill >= toughness * 2)
                return '2+';
            if (toughness >= skill * 2)
                return '6+';
            if (toughness > skill)
                return '5+';
            if (toughness < skill)
                return '3+';
            return '4+';
        }

        function showMessage(text) {
            var newMessage = $('<div>');
            newMessage.addClass('message');
            newMessage.html(text);

            $('#combatSection').append(newMessage);
        }

        // takes a string like "2D6+3" and returns the average result of that roll, in this case 10
        function getAvg(number) { 
            let numberStr = number.toString();
            if (!numberStr.includes('D'))
                return parseInt(number);

            let numberPart = 0;
            let diceRoll = 0;
            let numDice = 0;
            let parts = [];

            if (numberStr.includes('+')) {
                parts = numberStr.split('+');
                numberPart = parseInt(parts[1]);
                numberStr = parts[0];
            }
            if (numberStr.includes('-')) {
                parts = numberStr.split('-');
                numberPart = -parseInt(parts[1]);
                numberStr = parts[0];
            }

            parts = numberStr.split('D');
            numDice = parts[0] ? parseInt(parts[0]) : 1;
            diceRoll = parseInt(parts[1]);

            return numDice * (triangleNumber(diceRoll) / diceRoll) + numberPart;
        }

        // like factorial, but addition
        function triangleNumber(num) { 
            
            num = parseInt(num);

            if (num === 0) {
                return 0;
            } else if (num === 1) {
                return 1;
            } else if (num === -1) {
                return -1;
            } else {
                return num + triangleNumber(num - (num < 0 ? -1 : 1));
            }
        }

        function selectModel(side, name, checked = true) {
            combatants[side].models.forEach(model => {
                model.checked = (model.name === name);
            });
        }
        function selectWeapon(side,name, checked = true) { 
            combatants[side].weapons.forEach(weapon => {
                if (weapon.name === name) {
                    weapon.checked = checked;
                }   
            });
        }

        function updateModel(side, name, field, value) {
            combatants[side].models.forEach(model => {
                if (model.name === name) {   
                    if (field === 'keywords' || field === 'special') {
                        value = value.split(',').map(s => s.trim());
                    } 
                    model[field] = value;  
                }   
            });
        }
        function updateWeapon(side, name, field, value) { 
            combatants[side].weapons.forEach(weapon => {
                if (weapon.name === name) {
                    if (field === 'special') {
                        value = value.split(',').map(s => s.trim());
                    }
                    weapon[field] = value;
                }
            });
        }

        function registerExtensions() {
            // add some helper functions to prototypes for easier code later, only if they don't already exist to avoid conflicts with other libraries or future JS additions
            if (!Number.prototype.clamp) {
                Number.prototype.clamp = function(min, max) { 
                    return Math.min(Math.max(this, min), max);
                };
            }
            if (!String.prototype.hasSpecial) {
                String.prototype.hasSpecial = function(keyword, foundFunc, options = null) { 
                    const lower = this.toLowerCase();
                    const key   = keyword.toLowerCase();
                    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');// Escape keyword for regex safety
                    const regex = new RegExp(
                        escaped + "(.*?)(?=,|\\n|$)",
                        "g"
                    ); // Match keyword followed by any characters until a comma, newline, or end of string
                
                    while ((match = regex.exec(lower)) !== null) {
                        let keywordArgs = match[1].trim().toUpperCase();

                        foundFunc(keywordArgs, keyword, options);
                    }
                
                };
            }

            if (!String.prototype.toTitleCase) {
                String.prototype.toTitleCase = function() {
                    return this.replace(/\w\S*/g, function(txt) {
                        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
                    });
                };
            }

            // array version of hasSpecial
            if (!Array.prototype.hasSpecial) {
                Array.prototype.hasSpecial = function(keyword, foundFunc, options = null) {
                    for (let item of this) {
                        if (typeof item === 'string') {
                            item.hasSpecial(keyword, foundFunc, options);
                        }
                    }
                };
            }

        
            // extend Math.round to allow for rounding to a certain number of decimal places, used for cleaner output of results
            if (!Math.roundTo) {
                Math.roundTo = function(number, decimals) {
                    const factor = Math.pow(10, decimals);
                    return Math.round(number * factor) / factor;
                };
            }

        }

        function selectCheckbox($target) {
            const $combatantSection = $target.closest('.attacker, .defender');
            const side = $combatantSection.data('side');
            const type = $combatantSection.data('role');
            const name = $target.closest('.body').data('name');
            const checked = $target.is(':checked');

            selectHandlers[type](side, name, checked);
            checkButton();
        }

        function valueChange($target) {
            // when a value changes in the model or weapon grids, update the combatant data with the new value. 
            const $combatantSection = $target.closest('.attacker, .defender');
            const side = $combatantSection.data('side');
            const type = $combatantSection.data('role');
            const name = $target.closest('.body').data('name');
            const field = $target.attr('class');

            inputHandlers[type](side, name, field, $target.val());
        }

        return {

            /* ===== PUBLIC FUNCTIONS ===== */

            init: function() {
                console.log("MathHammer initialized");
                
                $('.pasteBox textarea').on('paste', pasteHandler);
                $('#swapBtn').on('click', swapSides);
                $('#calculateShooting').on('click', () => calculate(true));
                $('#calculateMelee').on('click', () => calculate(false));

                $('#modelSection, #weaponSection').on('change', 'input[type="radio"],input[type="checkbox"]', function(e) {
                    selectCheckbox($(e.target));
                });
                $('#modelSection, #weaponSection').on('change', 'input[type="text"], input[type="number"], textarea', function(e) {
                    valueChange($(e.target));
                });

                registerExtensions();
            },
            debug: function() {
                console.log("Combatants:", combatants);
            }
        }
    });
