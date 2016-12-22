/*

 return rounds for decimal games
 params : 
 	number 				= target number 
 	number_available    = "filter only" notions available 

*/



var _ 			= require('underscore')
var Distractor 	= require('./distractor.js')
var ModuleUtils = require('./module_utils.js')

var Decimal = function(number,  stimuli_type, numbers_available, count,  numbers_data){
	 
	 this.moduleutils = new ModuleUtils()
	 this.number = number
	 this.stimuli_type = stimuli_type
	 this.numbers_data = numbers_data

	 // NON SENS UNDER 12 
	 if(number<12){
			return;
	 }	

	var n 		= number.toString()
	var dec 	= parseInt(n[0])
	var unit 	= parseInt(n[1])
	var that 	= this
	var out 	= { 
					'pre_round' : [ 
						{
							'name': 'decimal',
							'value': dec*10, 
							'distractors': new Distractor(dec, numbers_available, count, true)
						},
						{ 	'name': 'unit',
							'value': unit,
							'distractors': new Distractor(unit, numbers_available, count)
						}, 
					]
	}

	if(out.pre_round){
		 
		var steps = []
		var round = {"steps": []}
		var step = {"type": that.stimuli_type, "stimuli": [] }

		// [dec, unit] 
		_.each(out.pre_round, function(r){
				
			var st =  that.moduleutils.addStimuli(true , r.value, 'number',that.numbers_data)
			st.unitOrDecimal = r.name;
			st.path = that.stimuli_type
			step.stimuli.push(st)

			_.each(r.distractors, function(d){
					//console.log(d.value)
					if(that.numbers_data[d.value]){

					}
					else{
						d.value = null;
					}
					var st =  that.moduleutils.addStimuli(false , d.value, 'number',that.numbers_data)
					st.unitOrDecimal = d.name;
					st.path = that.stimuli_type
					step.stimuli.push(st)	
			})

		})
		round.steps.push(step)
		round.targetSequence = {
				gameType        : that.stimuli_type, 
				targetNumber : that.number
		}

		out.round = round
	}

	return out;
}
module.exports =  Decimal;