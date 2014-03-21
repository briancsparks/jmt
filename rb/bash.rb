
require 'pry'

module Bash
  class Stream < Array
  end

  class PipeNode
    def initialize(pipeline, params = {})
      @pipeline = pipeline
      @params = params
    end

    def |(next_node='')
    end

    def evaluate(&block)
      self.instance_eval(&block)
    end
  end

  class Cut < PipeNode
    def initialize(pipeline, params = {})
      super
    end

    def to_s
      build
    end

    def build
      "cut -d#{delim} -f#{fields}"
    end

    def delim
      "'#{@params[:d] || ' '}'"
    end

    def fields
      @params[:f] || '1-'
    end
  end

  class Pipeline
    def initialize
      @commands = []
    end

    def method_missing(meth, *args)
      if meth == :cut
        @commands << Cut.new(self, *args)
      end
      @commands.last
    end

    def evaluate(&block)
      #@pipe_node = PipeNode.new self

      self.instance_eval(&block)
    end
  end
end

Bash::Pipeline.new.evaluate do
  cut(d: ' ', f: '1,2') | cut(d: ' ', f: '1,2')
  binding.pry
  foobar
end

