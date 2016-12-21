

/*

Skill Variante is a Skilltree-leaf
It prepare "rounds" depending on game type



*/


var _ 			= require('underscore')
var Suite 		= require('../suites.js')
var Sum 		= require('../sum.js')
var Decimal 	= require('../decimal.js')
var Shape 		= require('../shape.js')
var Recognition = require('../recognition.js')

var Distractor 	= require('../distractor.js')

var ModuleUtils = require('../module_utils.js')


function SkillVariante(el, params){
	/// this.numbers_data = numbers_data

	this.moduleutils = new ModuleUtils()

	this.name   = el.name
	this.group  = el.group
	this.number = el.number
	this.shape  = el.shape
	this.score  = el.score ? el.score : null;

	// console.log(el)
	// this.params = params

	/* GETTING PATHS */
	this.is_completed	= false
	this.hasround 		= false;
	this.average 		= null;
	this.record 		= []


	this.tries = el.tries ? el.tries : 0;
	console.log('this.tries'+this.tries)
	

	if(this.group == 'counting'){
		this.direction  =   el.paths[1] ? el.paths_[1] : null
		this.step       =   el.paths[2] ? el.paths_[2] : null
		this.from       =   el.paths[3] ? el.paths_[3] : null
		
		if(this.score[this.direction] && this.score[this.direction][this.step] && this.score[this.direction][this.step][this.from]){
			 // console.log('##'+this.number)
			 // console.log('dir '+this.direction)
			 // console.log('step '+this.step)
			 // console.log('from '+this.from)
			 this.score = this.score[this.direction][this.step][this.from]
			//console.log(this.score[this.direction][this.step][this.from] )
		}
	}
	if(this.group == 'sum'){
		this.sign       =   el.paths[1] ? el.paths_[1] : null
		this.side       =   el.paths[2] ? el.paths_[2] : null
		

		 console.log('el.side'+this.side)
		// el.paths[3] ? el.paths_[3] : null

		
			this.xnumber    =  '2'
					this.xnumber__    =  'xtwo'


		if(this.number >10){
			/// return null
		}





		if(this.score[this.sign] && this.score[this.sign][this.side] && this.score[this.sign][this.side][this.xnumber__]){
			 this.score = this.score[this.sign][this.side][this.xnumber__]
		}
	}
	if(this.group == 'recognition'){
		
		this.stimuli_type  =   el.paths[1] ? el.paths_[1] : null

		if(this.score[this.stimuli_type]){
			 this.score = this.score[this.stimuli_type]
		}
	}

	if(this.group == 'decimal'){ 
		this.stimuli_type   =   el.paths[1] ? el.paths_[1] : null

		if(this.score[this.stimuli_type]){
			 this.score = this.score[this.stimuli_type]
		}
	}

	if(this.group == 'shape'){ 
		this.stimuli_type   =   el.paths[1] ? el.paths_[1] : null

		if(this.score[this.stimuli_type]){
			 this.score = this.score[this.stimuli_type]
		}
	}


		// "records"


		this.record  = this.score ? this.score : []
		
		// this.getRecords();

		if(this.tries > 1){
		 this.is_completed = false

		}
		else{
			if(this.record.length > 0){

				var sum = 0;
				for (var i = 0 ; i < this.record.length; i++) {
					sum += this.record[i].score;
					// console.log(this.record[i])
				}
				this.average = sum/this.record.length
				if(this.average > 0.8){
					this.is_completed = true
				}
				else{
					/// this.is_completed = false
				}
			}

		}

		


		

		/// BLUR
	this.score = {}
	this.record = {}
		
	
	if(this.is_completed == true){
		/// dont need to contruct round.
	}
	else{
		this.round      =   this.toRound(params)
		if(this.round && this.round.round){
			//console.log(this.round )
			this.hasround   =   true;
		}
	}


	return this;     
}

SkillVariante.prototype.toRound = function (params) {
	var that = this;
	var numbers_data = params.numbers_data
	// console.log('this.name round')
	var step_suite

	if(this.group == 'counting'){

		if(this.step == 'oneby'){
			step_suite = 1
		}
		if(this.step == 'twoby'){
			step_suite = 2
		}
		if(this.step == 'fiveby'){
			step_suite = 5
		}
		if(this.step == 'tenby'){
			step_suite = 10
		}
		var tsuite = new Suite(this.number,10,step_suite,this.from,this.direction, 5, numbers_data, params.available_numbers)
		if(tsuite){
			var tround = {
				round: tsuite.round,
				target : this.number,
			//	suite : tsuite.suite,
			//	size: tsuite.length,
			//	sequence: tsuite.sequence,
				//expected_size: t.expected_size,
				//expected_match :t.expected_match,
				path : this.group+'__'+this.direction+'__'+this.step+'__'+this.from
			}
		 }
		else{
			 return null
		}
	}
	else if(this.group == 'recognition'){
		var trecognition = new Recognition(this.number,this.stimuli_type,  params.available_numbers, params.stepDistracterCount, numbers_data)

		var tround = {
				target : this.number,
				size: 1,
				round : trecognition.round,
				//expected_size: t.expected_size,
				//expected_match :t.expected_match,
				path : this.group+'__'+this.stimuli_type
		}
	 }
	 else if(this.group == 'decimal'){
				
		var decimal_round = new Decimal(this.number,this.stimuli_type,  params.available_numbers, params.stepDistracterCount, numbers_data)
		var tround = {
			target : this.number,
			size: 1,
			decimalGame: true,
			round : decimal_round.round,
			//expected_size: t.expected_size,
			//expected_match :t.expected_match,
			path : this.group+'__'+this.stimuli_type
		}
		
	}

	else if(this.group == 'sum'){

		var _side = ''

		console.log(this.side)
		if(this.side == 'lefts'){
			_side =  'left'
		}
		if(this.side == 'rights'){
			 _side =  'right'
		}
		//  console.log(this)
		var s 	= new Sum(this.number,this.xnumber,_side, this.sign, numbers_data, params.available_numbers, params.stepDistracterCount)
		

		var tround  = {
			target : this.number,
			size: 1,
			round: s.round,
			path : this.group+'__'+this.sign+'__'+this.side+'__'+this.xnumber
		}
	}
	
	else if(this.group == 'shape'){

		var shape_round = new Shape(this.shape, this.stimuli_type, params.available_shapes, params.stepDistracterCount, params.shapes_data)
		
		var tround 		= {
			target : this.shape,
			// shape_score : this.score,
			size: 1,
			round: shape_round.round,
			path : this.group+'__'+this.stimuli_type
		}
	}

	return tround
}

module.exports =  SkillVariante;
