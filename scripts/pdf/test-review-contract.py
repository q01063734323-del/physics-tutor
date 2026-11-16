"""Reviews cannot silently survive source changes or approve publication."""
import copy
import unittest
from review_contract import apply_review, source_fingerprint, solution_fingerprint, valid_answer


class ReviewContractTests(unittest.TestCase):
    def setUp(self):
        self.question = {'id':'q1','fragments':[{'asset':'condition.png','pdfPage':1,'bbox':[0,0,20,20],'role':'condition'}, {'asset':'solution.png','pdfPage':2,'bbox':[0,0,20,20],'role':'solution'}], 'sourceExerciseNumber':1,'sourceExamNumber':None,'sourceGroup':'g','answerCandidate':None,'answer':None,'rights':'unknown'}
        self.entry = {'sourceFingerprint':source_fingerprint(self.question),'checks':{key:True for key in ['conditionComplete','figuresChecked','mathChecked','numberChecked','answerChecked']},'evidence':{'conditionPages':[1],'answerPage':2,'note':'Visually compared with the source.'},'answer':{'type':'numeric','expected':'-2,5'}}

    def test_source_change_invalidates_review(self):
        self.question['fragments'][0]['asset']='different.png'
        self.assertIsNotNone(apply_review(self.question,self.entry))
        self.assertIsNone(self.question['answer'])

    def test_incomplete_review_is_rejected(self):
        self.entry['checks']['mathChecked']=False
        self.assertIsNotNone(apply_review(self.question,self.entry))

    def test_wrong_page_evidence_is_rejected(self):
        self.entry['evidence']['conditionPages']=[3]
        self.assertIsNotNone(apply_review(self.question,self.entry))

    def test_valid_review_keeps_rights_pending(self):
        self.assertIsNone(apply_review(self.question,self.entry))
        self.assertEqual(self.question['rights'],'unknown')
        self.assertEqual(self.question['review']['status'],'source_checked')
        self.assertNotIn('verifiedSolutionFragments',self.question)

    def test_verified_solution_requires_its_own_fingerprint(self):
        self.entry.update(solutionChecked=True,solutionFingerprint=solution_fingerprint(self.question))
        self.entry['evidence']['solutionPages']=[2]
        original=copy.deepcopy(self.question)
        self.assertIsNone(apply_review(self.question,self.entry))
        self.assertEqual(self.question['verifiedSolutionFragments'][0]['asset'],'solution.png')
        original['fragments'][1]['asset']='different-solution.png'
        self.assertIsNotNone(apply_review(original,self.entry))

    def test_answer_validation(self):
        for answer in [{'type':'numeric','expected':'nan'},{'type':'numeric','expected':''},{'type':'sequence','expected':[]},{'type':'multi_select','expected':[True]},{'type':'multi_select','expected':[{}]},{'type':'multi_select','expected':[1,1]},{'type':'manual','expected':''}]:
            self.assertFalse(valid_answer(answer),answer)
        for answer in [{'type':'numeric','expected':'-2,5'},{'type':'sequence','expected':['0','2']},{'type':'multi_select','expected':[1,3]},{'type':'manual','expected':'Source-backed written answer.'}]:
            self.assertTrue(valid_answer(answer),answer)


if __name__ == '__main__':
    unittest.main()
